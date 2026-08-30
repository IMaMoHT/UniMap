import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { selectableRooms } from '../config/positionedElements';
import { buildDeepLinkUrl } from '../utils/deepLink';
import { encodeQr, qrToSvg, type EccLevel } from '../utils/qrCode';
import { escapeHtml, sanitizeText, sanitizeUrl } from '../utils/sanitize';

/**
 * Адмін-інструмент: генерація QR-кодів «ти тут» для друку.
 * Кожен код веде на `<baseUrl>/?start=<roomId>` — застосунок підставить
 * цю кімнату як точку старту (див. utils/deepLink.ts).
 */

const inp: React.CSSProperties = {
  width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #444',
  background: '#111', color: '#fff', boxSizing: 'border-box', fontSize: 13,
};
const row: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 };
const lbl: React.CSSProperties = { fontSize: 12, color: '#aaa' };
const btn = (bg: string): React.CSSProperties => ({
  padding: 9, background: bg, color: '#fff', border: 'none', borderRadius: 6,
  cursor: 'pointer', fontWeight: 700, fontSize: 12,
});

const ECC_OPTIONS: { value: EccLevel; label: string }[] = [
  { value: 'L', label: 'L — 7% (менший код)' },
  { value: 'M', label: 'M — 15% (рекомендовано)' },
  { value: 'Q', label: 'Q — 25%' },
  { value: 'H', label: 'H — 30% (стійкий до пошкоджень)' },
];

const defaultBaseUrl = (): string =>
  typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : 'https://example.com/';

function downloadFile(filename: string, content: string, mime: string): void {
  try {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // прибираємо об'єктний URL, щоб не текла пам'ять
    setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch (error) {
    console.error('QR: не вдалося зберегти файл', error);
  }
}

/** Безпечне ім'я файлу: без слешів, лапок і крапок на початку */
const safeFileName = (value: string): string =>
  sanitizeText(value, 60).replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '') || 'qr';

export default function QrCodeAdmin() {
  const [baseUrl, setBaseUrl] = useState<string>(defaultBaseUrl);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [ecc, setEcc] = useState<EccLevel>('M');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = sanitizeText(query, 60).toLowerCase();
    if (!q) return selectableRooms;
    return selectableRooms.filter(
      (room) => room.label.toLowerCase().includes(q) || room.id.toLowerCase().includes(q),
    );
  }, [query]);

  const normalizedBase = sanitizeUrl(baseUrl, '');
  const baseIsValid = Boolean(normalizedBase);

  const previews = useMemo(() => {
    if (!baseIsValid) return [];
    return selectedIds.map((id) => {
      const room = selectableRooms.find((entry) => entry.id === id);
      const label = room ? `${room.label} · ${room.floor} пов.` : id;
      try {
        const url = buildDeepLinkUrl(normalizedBase, id);
        const svg = qrToSvg(encodeQr(url, ecc), { size: 240, caption: label });
        return { id, label, url, svg, error: null as string | null };
      } catch (error) {
        return {
          id, label, url: '', svg: '',
          error: error instanceof Error ? error.message : 'Не вдалося згенерувати QR',
        };
      }
    });
  }, [selectedIds, normalizedBase, baseIsValid, ecc]);

  const toggle = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const selectAllVisible = () =>
    setSelectedIds((prev) => Array.from(new Set([...prev, ...filtered.map((r) => r.id)])));

  const downloadSvg = (id: string) => {
    const item = previews.find((p) => p.id === id);
    if (!item?.svg) return;
    downloadFile(`qr_${safeFileName(id)}.svg`, item.svg, 'image/svg+xml');
  };

  /** SVG -> PNG через canvas (без зовнішніх бібліотек) */
  const downloadPng = (id: string) => {
    const item = previews.find((p) => p.id === id);
    if (!item?.svg) return;

    const image = new Image();
    const blobUrl = URL.createObjectURL(new Blob([item.svg], { type: 'image/svg+xml' }));
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = Math.round((1024 * image.height) / (image.width || 1));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('canvas 2d context недоступний');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `qr_${safeFileName(id)}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 0);
        }, 'image/png');
      } catch (error) {
        console.error('QR: не вдалося конвертувати в PNG', error);
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    };
    image.onerror = () => URL.revokeObjectURL(blobUrl);
    image.src = blobUrl;
  };

  /** Аркуш для друку: усі вибрані коди сіткою */
  const printSheet = () => {
    const valid = previews.filter((p) => p.svg);
    if (valid.length === 0) return;

    const cards = valid
      .map(
        (p) =>
          `<div class="card">${p.svg}<div class="url">${escapeHtml(p.url)}</div></div>`,
      )
      .join('');

    const html =
      `<!DOCTYPE html><html lang="uk"><head><meta charset="utf-8">` +
      `<title>QR-коди UniMap</title><style>` +
      `body{font-family:Inter,Arial,sans-serif;margin:16px}` +
      `.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}` +
      `.card{border:1px solid #ddd;border-radius:8px;padding:10px;text-align:center;break-inside:avoid}` +
      `.card svg{width:100%;height:auto}` +
      `.url{font-size:9px;color:#666;word-break:break-all;margin-top:6px}` +
      `@media print{.card{border-color:#999}}` +
      `</style></head><body><div class="grid">${cards}</div>` +
      `<script>window.onload=function(){window.print()}<\/script></body></html>`;

    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (!win) {
      // блокувальник спливаючих вікон — пропонуємо завантажити файл
      downloadFile('unimap_qr_sheet.html', html, 'text/html');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const panel = (
    <div style={{
      position: 'fixed', top: 16, right: 16, width: 340, zIndex: 100000, background: '#1a1a1a',
      border: '1px solid #333', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
      color: '#fff', padding: 16, fontFamily: 'sans-serif', maxHeight: '94vh', overflowY: 'auto',
    }}>
      <h4 style={{ margin: '0 0 12px', color: '#00ff00', fontSize: 15 }}>🔳 QR-коди для друку</h4>

      <div style={row}>
        <span style={lbl}>Адреса сайту (базовий URL)</span>
        <input
          style={{ ...inp, borderColor: baseIsValid ? '#444' : '#dc3545' }}
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://unimap.example.com/"
          spellCheck={false}
        />
        {!baseIsValid && (
          <span style={{ fontSize: 11, color: '#ff6b6b' }}>Потрібен коректний http(s) URL</span>
        )}
      </div>

      <div style={row}>
        <span style={lbl}>Рівень корекції помилок</span>
        <select style={inp} value={ecc} onChange={(e) => setEcc(e.target.value as EccLevel)}>
          {ECC_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div style={row}>
        <span style={lbl}>Пошук приміщення</span>
        <input style={inp} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Напр. 55 або Ректорат" />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button onClick={selectAllVisible} style={{ ...btn('#2f6f4f'), flex: 1 }}>
          ✔ Вибрати всі ({filtered.length})
        </button>
        <button onClick={() => setSelectedIds([])} style={btn('#333')}>Скинути</button>
      </div>

      <div style={{
        maxHeight: 190, overflowY: 'auto', border: '1px solid #333',
        borderRadius: 6, marginBottom: 12, background: '#111',
      }}>
        {filtered.length === 0 && (
          <div style={{ padding: 10, color: '#888', fontSize: 12 }}>Нічого не знайдено</div>
        )}
        {filtered.map((room) => (
          <label
            key={room.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
              fontSize: 12, cursor: 'pointer',
              background: selectedIds.includes(room.id) ? 'rgba(47,111,79,0.35)' : 'transparent',
            }}
          >
            <input type="checkbox" checked={selectedIds.includes(room.id)} onChange={() => toggle(room.id)} />
            <span style={{ flex: 1 }}>{room.label}</span>
            <span style={{ color: '#888' }}>{room.floor} пов.</span>
          </label>
        ))}
      </div>

      <button
        onClick={printSheet}
        disabled={previews.length === 0}
        style={{ ...btn(previews.length ? '#17a2b8' : '#333'), width: '100%', marginBottom: 12 }}
      >
        🖨 Друкувати аркуш ({previews.length})
      </button>

      {previews.map((p) => (
        <div key={p.id} style={{ borderTop: '1px solid #333', paddingTop: 10, marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: '#ffd54f', marginBottom: 6 }}>{p.label}</div>
          {p.error ? (
            <div style={{ fontSize: 11, color: '#ff6b6b' }}>{p.error}</div>
          ) : (
            <>
              <div
                style={{ background: '#fff', borderRadius: 6, padding: 6 }}
                // svg згенеровано локально нашим кодером; підпис і URL проходять
                // через escapeXml/escapeHtml, зовнішнього HTML тут немає
                dangerouslySetInnerHTML={{ __html: p.svg }}
              />
              <div style={{ fontSize: 10, color: '#888', wordBreak: 'break-all', margin: '6px 0' }}>{p.url}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => downloadSvg(p.id)} style={{ ...btn('#2f6f4f'), flex: 1 }}>SVG</button>
                <button onClick={() => downloadPng(p.id)} style={{ ...btn('#2f6f4f'), flex: 1 }}>PNG</button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );

  return createPortal(panel, document.body);
}

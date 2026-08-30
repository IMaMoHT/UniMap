/**
 * Санітизація зовнішніх даних.
 *
 * React екранує текст у JSX автоматично, тож класичний XSS через вставку тексту
 * тут неможливий. Реальні вектори, які ми закриваємо:
 *  1. дані з URL (QR-коди, посилання) — потрапляють у пошук/стан застосунку;
 *  2. значення з localStorage / конфігів, які можуть бути пошкоджені;
 *  3. рядки, що йдуть у SVG/HTML-рядки в обхід JSX (генерація QR, друк);
 *  4. `javascript:` / `data:` URL у полях, що рендеряться як посилання.
 */

/** Максимальна довжина будь-якого рядкового ідентифікатора з зовні */
const MAX_ID_LENGTH = 128;
/** Максимальна довжина пошукового запиту */
const MAX_QUERY_LENGTH = 100;

/** Прибирає керуючі символи (включно з нульовим байтом) і обрізає довжину. */
export function sanitizeText(value: unknown, maxLength = MAX_QUERY_LENGTH): string {
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim().slice(0, maxLength);
}

/**
 * Ідентифікатор кімнати/вузла: дозволяємо літери (в т.ч. кирилицю), цифри,
 * пробіл, дефіс, підкреслення, крапку. Усе інше відкидаємо — так у систему
 * не потрапить ні лапка, ні кутова дужка, ні шлях виду `../`.
 */
export function sanitizeId(value: unknown): string {
  if (typeof value !== 'string') return '';
  const cleaned = value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[^\p{L}\p{N}_.\- ]/gu, '')
    .trim();
  return cleaned.slice(0, MAX_ID_LENGTH);
}

/** Число з зовні: повертає fallback, якщо це не скінченне число. */
export function sanitizeNumber(value: unknown, fallback: number, min?: number, max?: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  let result = parsed;
  if (typeof min === 'number') result = Math.max(min, result);
  if (typeof max === 'number') result = Math.min(max, result);
  return result;
}

/** Ціле число з зовні (для номерів поверхів тощо). */
export function sanitizeInteger(value: unknown, fallback: number, min?: number, max?: number): number {
  const num = sanitizeNumber(value, fallback, min, max);
  return Math.round(num);
}

const SAFE_URL_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Пропускає лише http(s)-URL. Блокує `javascript:`, `data:`, `vbscript:` —
 * головний вектор XSS через посилання, згенеровані з користувацьких даних.
 */
export function sanitizeUrl(value: unknown, fallback = ''): string {
  const text = sanitizeText(value, 2048);
  if (!text) return fallback;
  try {
    const parsed = new URL(text, typeof window !== 'undefined' ? window.location.origin : 'https://localhost');
    if (!SAFE_URL_PROTOCOLS.has(parsed.protocol)) return fallback;
    return parsed.toString();
  } catch {
    return fallback;
  }
}

/** Екранування для вставки в HTML/SVG-рядок в обхід JSX (друк, завантаження файлів). */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}

/** Валідний CSS-колір у форматі #rgb / #rrggbb — інакше fallback. */
export function sanitizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim()) ? value.trim() : fallback;
}

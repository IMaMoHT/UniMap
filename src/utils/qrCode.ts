/**
 * Мінімальний QR-енкодер без зовнішніх залежностей.
 *
 * Підтримує byte-режим (UTF-8), версії 1–10, рівні корекції L/M/Q/H —
 * цього з головою вистачає для URL-ів виду
 * `https://unimap.example/?start=f1_node_181` (до ~270 символів).
 *
 * Алгоритм — стандарт ISO/IEC 18004 (та сама схема, що і в qrcodegen):
 * дані → блоки Ріда-Соломона → розкладка модулів → маскування → format/version info.
 */

export type EccLevel = 'L' | 'M' | 'Q' | 'H';

export interface QrMatrix {
  /** Розмір сторони в модулях (без «тихої зони») */
  size: number;
  /** modules[y][x] — true = чорний модуль */
  modules: boolean[][];
  version: number;
  ecc: EccLevel;
}

const MIN_VERSION = 1;
const MAX_VERSION = 10;

// Кількість кодових слів корекції на блок, індекс = версія (1-based, [0] не використовується)
const ECC_CODEWORDS_PER_BLOCK: Record<EccLevel, number[]> = {
  L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
  M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
  Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
  H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
};

const NUM_ECC_BLOCKS: Record<EccLevel, number[]> = {
  L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
  M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
  Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
  H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8],
};

// Біти рівня корекції у format info
const ECC_FORMAT_BITS: Record<EccLevel, number> = { L: 1, M: 0, Q: 3, H: 2 };

// ---------------------------------------------------------------------------
// Арифметика GF(256) для Ріда-Соломона (примітивний поліном 0x11D)
// ---------------------------------------------------------------------------

function gfMultiply(a: number, b: number): number {
  let result = 0;
  let x = a;
  let y = b;
  while (y > 0) {
    if (y & 1) result ^= x;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
    y >>= 1;
  }
  return result & 0xff;
}

/** Коефіцієнти генеруючого полінома степеня `degree` (без старшого члена) */
function rsGeneratorPoly(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1; // поліном = 1

  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < degree; j += 1) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], generator: number[]): number[] {
  const degree = generator.length;
  const result = new Array<number>(degree).fill(0);

  for (const byte of data) {
    const factor = byte ^ (result.shift() ?? 0);
    result.push(0);
    for (let i = 0; i < degree; i += 1) {
      result[i] ^= gfMultiply(generator[i], factor);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Місткість версій
// ---------------------------------------------------------------------------

function getNumRawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function getNumDataCodewords(version: number, ecc: EccLevel): number {
  return (
    Math.floor(getNumRawDataModules(version) / 8) -
    ECC_CODEWORDS_PER_BLOCK[ecc][version] * NUM_ECC_BLOCKS[ecc][version]
  );
}

function getAlignmentPatternPositions(version: number): number[] {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const size = version * 4 + 17;
  const step = Math.floor((version * 4 + numAlign * 2 + 1) / (numAlign * 2 - 2)) * 2;

  const result: number[] = [];
  for (let pos = size - 7; result.length < numAlign - 1; pos -= step) {
    result.unshift(pos);
  }
  result.unshift(6);
  return result;
}

// ---------------------------------------------------------------------------
// Кодування даних
// ---------------------------------------------------------------------------

class BitBuffer {
  readonly bits: number[] = [];

  append(value: number, length: number): void {
    for (let i = length - 1; i >= 0; i -= 1) {
      this.bits.push((value >>> i) & 1);
    }
  }

  get length(): number {
    return this.bits.length;
  }
}

function toUtf8Bytes(text: string): number[] {
  const encoded = new TextEncoder().encode(text);
  return Array.from(encoded);
}

/** Кількість бітів лічильника довжини для byte-режиму (версії 1–9 / 10+) */
function byteModeCountBits(version: number): number {
  return version <= 9 ? 8 : 16;
}

function buildDataCodewords(bytes: number[], version: number, ecc: EccLevel): number[] {
  const capacityBits = getNumDataCodewords(version, ecc) * 8;
  const buffer = new BitBuffer();

  buffer.append(0b0100, 4); // індикатор byte-режиму
  buffer.append(bytes.length, byteModeCountBits(version));
  for (const byte of bytes) buffer.append(byte, 8);

  // термінатор + вирівнювання до байта
  buffer.append(0, Math.min(4, capacityBits - buffer.length));
  buffer.append(0, (8 - (buffer.length % 8)) % 8);

  const codewords: number[] = [];
  for (let i = 0; i < buffer.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j += 1) byte = (byte << 1) | buffer.bits[i + j];
    codewords.push(byte);
  }

  // добивання паддінгом 0xEC / 0x11
  const padBytes = [0xec, 0x11];
  for (let i = 0; codewords.length * 8 < capacityBits; i += 1) {
    codewords.push(padBytes[i % 2]);
  }

  return codewords;
}

/**
 * Перемежування блоків за стандартом: спершу побайтово всі блоки даних,
 * потім побайтово всі блоки корекції. Довгі блоки містять на один байт даних
 * більше — на «зайвому» кроці короткі блоки просто пропускаються.
 */
function addEccAndInterleave(data: number[], version: number, ecc: EccLevel): number[] {
  const numBlocks = NUM_ECC_BLOCKS[ecc][version];
  const eccPerBlock = ECC_CODEWORDS_PER_BLOCK[ecc][version];
  const rawCodewords = Math.floor(getNumRawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);
  const shortDataLen = shortBlockLen - eccPerBlock;

  const generator = rsGeneratorPoly(eccPerBlock);
  const dataBlocks: number[][] = [];
  const eccBlocks: number[][] = [];

  let offset = 0;
  for (let i = 0; i < numBlocks; i += 1) {
    const dataLen = shortDataLen + (i < numShortBlocks ? 0 : 1);
    const blockData = data.slice(offset, offset + dataLen);
    offset += dataLen;
    dataBlocks.push(blockData);
    eccBlocks.push(rsRemainder(blockData, generator));
  }

  const result: number[] = [];
  for (let i = 0; i <= shortDataLen; i += 1) {
    for (let j = 0; j < numBlocks; j += 1) {
      if (i < dataBlocks[j].length) result.push(dataBlocks[j][i]);
    }
  }
  for (let i = 0; i < eccPerBlock; i += 1) {
    for (let j = 0; j < numBlocks; j += 1) {
      result.push(eccBlocks[j][i]);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Побудова матриці
// ---------------------------------------------------------------------------

class QrBuilder {
  readonly size: number;
  readonly modules: boolean[][];
  readonly version: number;
  readonly ecc: EccLevel;
  private readonly reserved: boolean[][];

  constructor(version: number, ecc: EccLevel) {
    this.version = version;
    this.ecc = ecc;
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.reserved = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
  }

  private setFunction(x: number, y: number, dark: boolean): void {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return;
    this.modules[y][x] = dark;
    this.reserved[y][x] = true;
  }

  private drawFinder(cx: number, cy: number): void {
    for (let dy = -4; dy <= 4; dy += 1) {
      for (let dx = -4; dx <= 4; dx += 1) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        this.setFunction(cx + dx, cy + dy, dist !== 2 && dist !== 4);
      }
    }
  }

  private drawAlignment(cx: number, cy: number): void {
    for (let dy = -2; dy <= 2; dy += 1) {
      for (let dx = -2; dx <= 2; dx += 1) {
        this.setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  drawFunctionPatterns(): void {
    // тайминг-патерни
    for (let i = 0; i < this.size; i += 1) {
      this.setFunction(6, i, i % 2 === 0);
      this.setFunction(i, 6, i % 2 === 0);
    }

    this.drawFinder(3, 3);
    this.drawFinder(this.size - 4, 3);
    this.drawFinder(3, this.size - 4);

    const alignPositions = getAlignmentPatternPositions(this.version);
    const last = alignPositions.length - 1;
    for (let i = 0; i <= last; i += 1) {
      for (let j = 0; j <= last; j += 1) {
        // пропускаємо кути, зайняті finder-патернами
        const isCorner = (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0);
        if (!isCorner) this.drawAlignment(alignPositions[i], alignPositions[j]);
      }
    }

    // резервуємо місце під format info (значення запишемо після вибору маски)
    this.drawFormatBits(0);
    this.drawVersionBits();

    // «темний модуль»
    this.setFunction(8, this.size - 8, true);
  }

  drawFormatBits(mask: number): void {
    const data = (ECC_FORMAT_BITS[this.ecc] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i += 1) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;

    const bitAt = (i: number) => ((bits >>> i) & 1) === 1;

    for (let i = 0; i <= 5; i += 1) this.setFunction(8, i, bitAt(i));
    this.setFunction(8, 7, bitAt(6));
    this.setFunction(8, 8, bitAt(7));
    this.setFunction(7, 8, bitAt(8));
    for (let i = 9; i < 15; i += 1) this.setFunction(14 - i, 8, bitAt(i));

    for (let i = 0; i < 8; i += 1) this.setFunction(this.size - 1 - i, 8, bitAt(i));
    for (let i = 8; i < 15; i += 1) this.setFunction(8, this.size - 15 + i, bitAt(i));
  }

  private drawVersionBits(): void {
    if (this.version < 7) return;
    let rem = this.version;
    for (let i = 0; i < 12; i += 1) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.version << 12) | rem;

    for (let i = 0; i < 18; i += 1) {
      const dark = ((bits >>> i) & 1) === 1;
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.setFunction(a, b, dark);
      this.setFunction(b, a, dark);
    }
  }

  /**
   * Обхід вільних модулів «змійкою» знизу-справа вгору, парами колонок.
   * Єдине джерело правди для запису й читання — щоб порядок не розʼїхався.
   */
  private eachDataModule(visit: (x: number, y: number) => boolean | void): void {
    let right = this.size - 1;
    while (right >= 1) {
      if (right === 6) right = 5; // колонка 6 зайнята вертикальним таймингом
      for (let v = 0; v < this.size; v += 1) {
        for (let j = 0; j < 2; j += 1) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? this.size - 1 - v : v;
          if (this.reserved[y][x]) continue;
          if (visit(x, y) === false) return;
        }
      }
      right -= 2;
    }
  }

  /** Розкладка кодових слів «змійкою» справа наліво */
  drawCodewords(codewords: number[]): void {
    const totalBits = codewords.length * 8;
    let i = 0;
    this.eachDataModule((x, y) => {
      if (i >= totalBits) return false; // решта (remainder bits) лишається світлою
      this.modules[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) === 1;
      i += 1;
    });
  }

  /** Читає біти даних у тому ж порядку — використовується для самоперевірки */
  readCodewordBits(bitCount: number): number[] {
    const bits: number[] = [];
    this.eachDataModule((x, y) => {
      if (bits.length >= bitCount) return false;
      bits.push(this.modules[y][x] ? 1 : 0);
    });
    return bits;
  }

  isReserved(x: number, y: number): boolean {
    return this.reserved[y][x];
  }

  applyMask(mask: number): void {
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        if (this.reserved[y][x]) continue;
        let invert = false;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          case 7: invert = ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0; break;
          default: invert = false;
        }
        if (invert) this.modules[y][x] = !this.modules[y][x];
      }
    }
  }

  /** Штрафні бали за стандартом — для вибору найкращої маски */
  penaltyScore(): number {
    let score = 0;
    const N1 = 3, N2 = 3, N3 = 40, N4 = 10;

    const runScore = (runLength: number) => (runLength >= 5 ? N1 + (runLength - 5) : 0);

    // правило 1: підряд однакові модулі в рядку/стовпці
    for (let y = 0; y < this.size; y += 1) {
      let runColor = this.modules[y][0];
      let runLength = 1;
      for (let x = 1; x < this.size; x += 1) {
        if (this.modules[y][x] === runColor) {
          runLength += 1;
        } else {
          score += runScore(runLength);
          runColor = this.modules[y][x];
          runLength = 1;
        }
      }
      score += runScore(runLength);
    }
    for (let x = 0; x < this.size; x += 1) {
      let runColor = this.modules[0][x];
      let runLength = 1;
      for (let y = 1; y < this.size; y += 1) {
        if (this.modules[y][x] === runColor) {
          runLength += 1;
        } else {
          score += runScore(runLength);
          runColor = this.modules[y][x];
          runLength = 1;
        }
      }
      score += runScore(runLength);
    }

    // правило 2: блоки 2×2
    for (let y = 0; y < this.size - 1; y += 1) {
      for (let x = 0; x < this.size - 1; x += 1) {
        const c = this.modules[y][x];
        if (c === this.modules[y][x + 1] && c === this.modules[y + 1][x] && c === this.modules[y + 1][x + 1]) {
          score += N2;
        }
      }
    }

    // правило 3: патерн 1:1:3:1:1 з розділювачем
    const pattern = [true, false, true, true, true, false, true];
    const matchesAt = (get: (i: number) => boolean, start: number, len: number): boolean => {
      if (start + 7 > len) return false;
      for (let k = 0; k < 7; k += 1) if (get(start + k) !== pattern[k]) return false;
      const beforeClear = start - 4 < 0 || [1, 2, 3, 4].every((d) => !get(start - d));
      const afterClear = start + 10 >= len || [7, 8, 9, 10].every((d) => !get(start + d));
      return beforeClear || afterClear;
    };
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        if (matchesAt((i) => this.modules[y][i], x, this.size)) score += N3;
        if (matchesAt((i) => this.modules[i][x], y, this.size)) score += N3;
      }
    }

    // правило 4: баланс чорних/білих
    let dark = 0;
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) if (this.modules[y][x]) dark += 1;
    }
    const total = this.size * this.size;
    const k = Math.floor((Math.abs(dark * 20 - total * 10) * 10) / total / 5);
    score += k * N4;

    return score;
  }
}

// ---------------------------------------------------------------------------
// Публічний API
// ---------------------------------------------------------------------------

export class QrEncodeError extends Error {}

/** Мінімальна версія, у яку влізуть дані заданої довжини */
function pickVersion(byteLength: number, ecc: EccLevel): number {
  for (let version = MIN_VERSION; version <= MAX_VERSION; version += 1) {
    const capacity = getNumDataCodewords(version, ecc) - 1 - Math.ceil(byteModeCountBits(version) / 8);
    if (byteLength <= capacity) return version;
  }
  throw new QrEncodeError(
    `Текст задовгий для QR (${byteLength} байт). Скороти URL або знизь рівень корекції.`,
  );
}

export function encodeQr(text: string, ecc: EccLevel = 'M'): QrMatrix {
  if (typeof text !== 'string' || text.length === 0) {
    throw new QrEncodeError('Порожній текст — нема чого кодувати.');
  }

  const bytes = toUtf8Bytes(text);
  const version = pickVersion(bytes.length, ecc);

  const dataCodewords = buildDataCodewords(bytes, version, ecc);
  const allCodewords = addEccAndInterleave(dataCodewords, version, ecc);

  const builder = new QrBuilder(version, ecc);
  builder.drawFunctionPatterns();
  builder.drawCodewords(allCodewords);

  // вибираємо маску з найменшим штрафом
  let bestMask = 0;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask += 1) {
    builder.applyMask(mask);
    builder.drawFormatBits(mask);
    const score = builder.penaltyScore();
    if (score < bestScore) {
      bestScore = score;
      bestMask = mask;
    }
    builder.applyMask(mask); // повертаємо як було: XOR — сам собі обернений
  }

  builder.applyMask(bestMask);
  builder.drawFormatBits(bestMask);

  return {
    size: builder.size,
    modules: builder.modules.map((row) => [...row]),
    version,
    ecc,
  };
}

export interface QrSvgOptions {
  /** Розмір готового SVG у пікселях */
  size?: number;
  /** Ширина «тихої зони» в модулях (стандарт вимагає ≥4) */
  margin?: number;
  dark?: string;
  light?: string;
  /** Підпис під кодом (наприклад, назва аудиторії) */
  caption?: string;
}

const escapeXml = (value: string): string =>
  value.replace(/[<>&"']/g, (char) => {
    switch (char) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      default: return '&apos;';
    }
  });

/** Рендерить матрицю в самодостатній SVG-рядок (друк / завантаження) */
export function qrToSvg(matrix: QrMatrix, options: QrSvgOptions = {}): string {
  const { size = 512, margin = 4, dark = '#000000', light = '#ffffff', caption } = options;

  const safeMargin = Math.max(0, Math.floor(margin));
  const dim = matrix.size + safeMargin * 2;
  const captionHeight = caption ? Math.max(6, Math.round(dim * 0.14)) : 0;
  const totalHeight = dim + captionHeight;

  let path = '';
  for (let y = 0; y < matrix.size; y += 1) {
    for (let x = 0; x < matrix.size; x += 1) {
      if (matrix.modules[y][x]) path += `M${x + safeMargin} ${y + safeMargin}h1v1h-1z`;
    }
  }

  const captionSvg = caption
    ? `<text x="${dim / 2}" y="${dim + captionHeight * 0.7}" text-anchor="middle" ` +
      `font-family="Inter, Arial, sans-serif" font-size="${captionHeight * 0.55}" fill="${dark}">` +
      `${escapeXml(caption)}</text>`
    : '';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round((size * totalHeight) / dim)}" ` +
    `viewBox="0 0 ${dim} ${totalHeight}" shape-rendering="crispEdges">` +
    `<rect width="${dim}" height="${totalHeight}" fill="${light}"/>` +
    `<path d="${path}" fill="${dark}"/>` +
    captionSvg +
    `</svg>`
  );
}

// Внутрішні хелпери, відкриті для самоперевірки в тестах
export const __internals = {
  getNumDataCodewords,
  getNumRawDataModules,
  getAlignmentPatternPositions,
  rsGeneratorPoly,
  rsRemainder,
  gfMultiply,
  buildDataCodewords,
  addEccAndInterleave,
  QrBuilder,
  ECC_CODEWORDS_PER_BLOCK,
  NUM_ECC_BLOCKS,
};

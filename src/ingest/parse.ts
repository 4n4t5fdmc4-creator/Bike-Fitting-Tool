/**
 * Parsing a pasted geometry table.
 *
 * Why paste and not fetch: a static site cannot read a manufacturer page. Tried
 * on 2026-09-01 across eight brands - Pinarello returned 404, Wilier 403, Factor
 * loads its table with JavaScript, and the aggregator sites return 403 to
 * automated requests. Only Bianchi served a table in plain HTML, and its columns
 * were unlabelled letters keyed to a drawing.
 *
 * So the rider copies the table and pastes it. Nothing here is ever trusted:
 * every parsed value goes to a review screen before it is saved.
 */

/** Canonical fields we try to recognise. */
export type FieldKey =
  | 'size' | 'stack' | 'reach' | 'headTubeAngle' | 'seatTubeAngle'
  | 'headTubeLength' | 'seatTubeLength' | 'effectiveTopTube' | 'chainstay'
  | 'wheelbase' | 'bbDrop' | 'forkRake' | 'trail' | 'tyreMax' | 'standover';

/**
 * Synonyms in the three languages the major brands publish in. Matching is a
 * cascade - exact, then abbreviation, then token similarity - never pure fuzzy.
 */
/*
 * Spelling variants matter more than they look. Pinarello publishes "HEADTUBE
 * ANGLE" as one word; the two-word spelling alone silently failed to match it,
 * and a legend entry that does not resolve is a column quietly dropped.
 */
const SYNONYMS: Record<FieldKey, string[]> = {
  size: ['size', 'frame size', 'groesse', 'grosse', 'rahmenhohe', 'rahmengrosse', 'taglia'],
  stack: ['stack', 'frame stack', 'stack height', 'uberhohung'],
  reach: ['reach', 'frame reach', 'horizontal reach'],
  headTubeAngle: ['head tube angle', 'headtube angle', 'head angle', 'steering tube angle', 'steering angle', 'steerer angle', 'fork angle', 'steuerrohrwinkel', 'lenkwinkel', 'angolo sterzo'],
  seatTubeAngle: ['seat tube angle', 'seattube angle', 'seat angle', 'sitzrohrwinkel', 'angolo piantone'],
  headTubeLength: ['head tube', 'headtube', 'head tube length', 'steuerrohr', 'steuerrohrlange', 'tubo sterzo'],
  seatTubeLength: ['seat tube', 'seattube', 'seat tube length', 'sitzrohr', 'rahmenhohe', 'tubo piantone'],
  effectiveTopTube: ['top tube', 'top tube length', 'effective top tube', 'horizontal top tube', 'top tube horizontal', 'top tube effective', 'virtual top tube', 'oberrohr', 'oberrohr horizontal', 'tubo orizzontale', 'tubo orizzontale virtuale'],
  chainstay: ['chainstay', 'chain stay', 'chainstay length', 'chain stay length', 'rear centre length', 'rear centre', 'rear center', 'kettenstrebe', 'foderi bassi'],
  wheelbase: ['wheelbase', 'wheel base', 'radstand', 'interasse'],
  bbDrop: ['bb drop', 'bottom bracket drop', 'tretlagerabsenkung', 'ribassamento'],
  forkRake: ['fork rake', 'fork offset', 'fork rake offset', 'rake', 'offset', 'gabelvorbiegung'],
  trail: ['trail', 'nachlauf', 'avancorsa'],
  tyreMax: ['max tyre', 'max tire', 'maximum tyre', 'maximum tire', 'max tyre width', 'max tire width', 'max tyre clearance', 'max tire clearance', 'tyre clearance', 'tire clearance', 'maximale reifenbreite', 'reifenfreiheit'],
  standover: ['standover', 'stand over', 'standover height', 'bike standover height', 'uberstandshohe', 'altezza cavallo'],
};

/** Lowercase, strip units, punctuation and diacritics, collapse whitespace. */
export function normaliseHeader(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(mm|cm|deg|degrees|grad|°)\b/g, ' ')
    .replace(/[-–—/]/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const dice = (a: string, b: string): number => {
  const ta = new Set(a.split(' ').filter(Boolean));
  const tb = new Set(b.split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return (2 * shared) / (ta.size + tb.size);
};

export interface HeaderMatch {
  field: FieldKey | null;
  confidence: number;
  /** How the match was made, shown in review so a guess is visible as a guess. */
  method: 'exact' | 'abbreviation' | 'fuzzy' | 'none';
}

/**
 * Abbreviations live here and ONLY here. Keeping them out of the synonym lists
 * is what lets `method` mean something: an abbreviation is a slightly weaker
 * match than a spelled-out header, and the review screen shows that difference.
 */
const ABBREVIATIONS: Record<string, FieldKey> = {
  hta: 'headTubeAngle', sta: 'seatTubeAngle', ht: 'headTubeLength',
  st: 'seatTubeLength', tt: 'effectiveTopTube', cs: 'chainstay',
  wb: 'wheelbase', bb: 'bbDrop',
};

export function matchHeader(raw: string): HeaderMatch {
  const h = normaliseHeader(raw);
  if (!h) return { field: null, confidence: 0, method: 'none' };

  for (const [field, list] of Object.entries(SYNONYMS) as [FieldKey, string[]][]) {
    if (list.includes(h)) return { field, confidence: 1, method: 'exact' };
  }
  // Collapsing whitespace is not a guess: "Chain-Stay", "chain stay" and
  // "chainstay" are one word written three ways. Doing this before the fuzzy
  // stage keeps a certain match from being downgraded to a probable one.
  const squashed = h.replace(/ /g, '');
  for (const [field, list] of Object.entries(SYNONYMS) as [FieldKey, string[]][]) {
    if (list.some((x) => x.replace(/ /g, '') === squashed)) {
      return { field, confidence: 1, method: 'exact' };
    }
  }

  const abbr = ABBREVIATIONS[h];
  if (abbr) return { field: abbr, confidence: 0.95, method: 'abbreviation' };

  let best: { field: FieldKey; score: number } | null = null;
  for (const [field, list] of Object.entries(SYNONYMS) as [FieldKey, string[]][]) {
    for (const s of list) {
      const score = dice(h, s);
      if (!best || score > best.score) best = { field, score };
    }
  }
  if (best && best.score >= 0.72) {
    return { field: best.field, confidence: 0.7, method: 'fuzzy' };
  }
  return { field: null, confidence: 0, method: 'none' };
}

/**
 * Parse one cell into a number.
 *
 * Handles the European decimal comma, thousands separators, ranges from
 * adjustable dropouts, footnote markers and approximation signs. Returns null
 * for anything absent - never zero, which would be a silent wrong answer.
 */
export function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(/[*†‡~≈]/g, '').trim();
  if (!s || /^(n\/?a|-+|—|–)$/i.test(s)) return null;

  const range = s.match(/^(\d+[.,]?\d*)\s*[-–—]\s*(\d+[.,]?\d*)$/);
  if (range?.[1] && range[2]) {
    const a = parseNumber(range[1]);
    const b = parseNumber(range[2]);
    return a !== null && b !== null ? (a + b) / 2 : null;
  }

  let t = s.replace(/\s/g, '');
  // A comma followed by exactly three digits at the end is a thousands
  // separator; otherwise it is a decimal comma.
  if (/,\d{3}$/.test(t) && !/\.\d/.test(t)) t = t.replace(',', '');
  else t = t.replace(',', '.');

  const n = Number(t.replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Legend parsing.
 *
 * Several manufacturers publish geometry with single-letter columns keyed to a
 * drawing - Pinarello uses CE, CC, L, A, B, P, T, D, R, G; Bianchi uses A, B1,
 * C, D, E, F, G, G1. The letters are meaningless on their own, which is why
 * `matchHeader` refuses to guess at them. But the same page usually prints a
 * legend, and pasting that alongside the table makes the whole thing readable:
 *
 *   "A [°]: SEAT TUBE ANGLE, B [°]: HEADTUBE ANGLE, P: CHAINSTAY, ..."
 *
 * Each description is run through the ordinary matcher, so the legend inherits
 * the same multi-language synonyms and the same refusal to guess.
 */
export function parseLegend(text: string): Record<string, FieldKey> {
  const out: Record<string, FieldKey> = {};
  // Split on commas or newlines, but only where a "KEY: description" follows.
  for (const part of text.split(/[,\n;]/)) {
    const m = part.match(/^\s*([A-Za-z]{1,3}\d?)\s*(?:\[[^\]]*\])?\s*:\s*(.+?)\s*$/);
    if (!m?.[1] || !m[2]) continue;
    const key = m[1].toLowerCase();
    const matched = matchHeader(m[2]);
    if (matched.field) out[key] = matched.field;
  }
  return out;
}

/** Resolve a header, consulting a legend before giving up on a letter column. */
export function matchHeaderWithLegend(
  raw: string,
  legend: Record<string, FieldKey>,
): HeaderMatch {
  const direct = matchHeader(raw);
  if (direct.field) return direct;

  const key = raw.toLowerCase().replace(/\[[^\]]*\]/g, '').replace(/[^a-z0-9]/g, '').trim();
  const viaLegend = legend[key];
  if (viaLegend) return { field: viaLegend, confidence: 0.95, method: 'abbreviation' };
  return direct;
}

export interface RawTable {
  headers: string[];
  rows: string[][];
}

/** Split pasted text into a grid. Tabs win, then multi-space, then commas. */
export function splitPaste(text: string): RawTable | null {
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim() !== '');
  if (lines.length < 2) return null;

  const first = lines[0] ?? '';
  const delimiter = first.includes('\t') ? '\t' : first.includes(';') ? ';' : first.includes(',') ? ',' : /\s{2,}/;
  const cells = (l: string): string[] =>
    (typeof delimiter === 'string' ? l.split(delimiter) : l.split(delimiter)).map((c) => c.trim());

  const grid = lines.map(cells);
  const width = Math.max(...grid.map((r) => r.length));
  if (width < 2) return null;

  const headers = grid[0] ?? [];
  return { headers, rows: grid.slice(1) };
}

const SIZE_TOKEN = /^(3[5-9]|4\d|5\d|6[0-5])(\.\d)?$|^(XXS|XS|S|M|ML|L|XL|XXL)$|^\d{3}$/i;

/**
 * A third table shape: a vertical label/value list describing ONE size, with the
 * size chosen by a control elsewhere on the page. Specialized publishes this
 * way, as do several others - "Frame Stack | 501mm" down the page rather than a
 * matrix across it.
 *
 * Detected rather than assumed: two columns wide, and the left column has to
 * read like field names. A two-column matrix of one size against one measurement
 * would look identical otherwise.
 */
export function isSpecList(t: RawTable): boolean {
  const all = [t.headers, ...t.rows];
  if (all.length < 4) return false;
  if (all.some((r) => r.length !== 2)) return false;
  const named = all.filter((r) => matchHeader(r[0] ?? '').field !== null).length;
  return named >= 3;
}

/** Turn a label/value list into a one-row table the rest of the pipeline understands. */
export function specListToRow(t: RawTable): RawTable {
  const all = [t.headers, ...t.rows];
  return {
    headers: all.map((r) => r[0] ?? ''),
    rows: [all.map((r) => r[1] ?? '')],
  };
}

/**
 * Geometry tables come both ways: sizes across the top, or sizes down the side.
 * Detected by looking for size-like tokens rather than assumed.
 */
export function detectOrientation(t: RawTable): 'sizesAsColumns' | 'sizesAsRows' | 'ambiguous' {
  const headerHits = t.headers.filter((h) => SIZE_TOKEN.test(h.trim())).length;
  const firstColHits = t.rows.filter((r) => SIZE_TOKEN.test((r[0] ?? '').trim())).length;
  if (headerHits >= 2 && firstColHits < 2) return 'sizesAsColumns';
  if (firstColHits >= 2 && headerHits < 2) return 'sizesAsRows';
  return 'ambiguous';
}

/** Transpose so that every row is one size. */
export function toSizeRows(t: RawTable): RawTable {
  const grid = [t.headers, ...t.rows];
  const width = Math.max(...grid.map((r) => r.length));
  const out: string[][] = [];
  for (let c = 0; c < width; c++) out.push(grid.map((r) => r[c] ?? ''));
  const headers = out[0] ?? [];
  return { headers, rows: out.slice(1) };
}

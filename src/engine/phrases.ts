/**
 * Comparison phrases.
 *
 * Generated, never authored per case: the phrase must always agree with the
 * numbers, and there are far too many combinations to write by hand.
 * See docs/explanation-system.md section 3.
 */

/** Magnitude bands. Index 0 means "no meaningful difference". */
const BAND_LIMITS = [5, 12, 25, 40] as const;
const QUALIFIERS = ['', 'slightly ', '', 'noticeably ', 'much '] as const;

export type BandIndex = 0 | 1 | 2 | 3 | 4;

export function bandOf(delta: number): BandIndex {
  const a = Math.abs(delta);
  for (let i = 0; i < BAND_LIMITS.length; i++) {
    const limit = BAND_LIMITS[i];
    if (limit !== undefined && a < limit) return i as BandIndex;
  }
  return 4;
}

export interface Comparison {
  /** Short form for chips and headings, e.g. "more aggressive". */
  readonly label: string;
  /** Prose form built from the actual numbers, e.g. "18 mm longer and 14 mm lower". */
  readonly precise: string;
}

/**
 * @param deltaReach positive = the candidate is longer
 * @param deltaStack positive = the candidate is taller
 */
export function compare(deltaReach: number, deltaStack: number): Comparison {
  const br = bandOf(deltaReach);
  const bs = bandOf(deltaStack);
  const reachWord = br ? (deltaReach > 0 ? 'longer' : 'shorter') : null;
  const stackWord = bs ? (deltaStack > 0 ? 'taller' : 'lower') : null;

  let label: string;
  const opposedDiagonal = deltaReach > 0 !== deltaStack > 0;

  if (br >= 2 && bs >= 2 && opposedDiagonal) {
    // Only two of the four quadrants have a name a fitter uses. The qualifier
    // comes from the stronger axis - without it, +16/-18 and +45/-40 would read
    // identically, which is a lie a rider would act on.
    const idiom = deltaReach > 0 ? 'more aggressive' : 'more relaxed';
    label = QUALIFIERS[Math.max(br, bs) as BandIndex] + idiom;
  } else if (reachWord && stackWord) {
    // A shared qualifier is stated once: "much shorter and lower", never
    // "much shorter and much lower".
    label =
      br === bs
        ? `${QUALIFIERS[br]}${reachWord} and ${stackWord}`
        : `${QUALIFIERS[br]}${reachWord} and ${QUALIFIERS[bs]}${stackWord}`;
  } else if (reachWord) {
    label = QUALIFIERS[br] + reachWord;
  } else if (stackWord) {
    label = QUALIFIERS[bs] + stackWord;
  } else {
    label = 'essentially the same';
  }

  const parts: string[] = [];
  if (reachWord) parts.push(`${Math.round(Math.abs(deltaReach))} mm ${reachWord}`);
  if (stackWord) parts.push(`${Math.round(Math.abs(deltaStack))} mm ${stackWord}`);

  return {
    label: label.trim(),
    precise: parts.length ? parts.join(' and ') : 'within a few millimetres in both axes',
  };
}

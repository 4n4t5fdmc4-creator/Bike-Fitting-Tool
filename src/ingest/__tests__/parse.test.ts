import { describe, expect, it } from 'vitest';
import {
  detectOrientation, matchHeader, matchHeaderWithLegend, normaliseHeader, parseLegend,
  parseNumber, splitPaste, toSizeRows,
} from '../parse';

describe('header normalisation', () => {
  it('strips units, punctuation and diacritics', () => {
    expect(normaliseHeader('Stack (mm)')).toBe('stack');
    expect(normaliseHeader('Head Tube Angle (°)')).toBe('head tube angle');
    expect(normaliseHeader('Steuerrohrwinkel')).toBe('steuerrohrwinkel');
  });
});

describe('header matching is a cascade, never pure fuzzy', () => {
  it('matches English, German and Italian exactly', () => {
    expect(matchHeader('Stack').field).toBe('stack');
    expect(matchHeader('Steuerrohrwinkel').field).toBe('headTubeAngle');
    expect(matchHeader('Angolo sterzo').field).toBe('headTubeAngle');
    expect(matchHeader('Radstand').field).toBe('wheelbase');
  });

  it('resolves abbreviations', () => {
    expect(matchHeader('HTA')).toMatchObject({ field: 'headTubeAngle', method: 'abbreviation' });
    expect(matchHeader('CS')).toMatchObject({ field: 'chainstay', method: 'abbreviation' });
  });

  it('normalises units away before matching, so a unit suffix stays exact', () => {
    const m = matchHeader('Head tube angle (°)');
    expect(m).toMatchObject({ field: 'headTubeAngle', method: 'exact' });
  });

  it('marks a genuinely fuzzy match as a guess rather than passing it off as certain', () => {
    const m = matchHeader('Head tube angle front');
    expect(m.field).toBe('headTubeAngle');
    expect(m.confidence).toBeLessThan(1);
    expect(m.method).toBe('fuzzy');
  });

  it('refuses to guess at unlabelled columns', () => {
    // Bianchi publishes its geometry with letter columns keyed to a drawing.
    // Guessing what "G1" means would be worse than asking.
    for (const h of ['A', 'B1', 'G', 'G1', 'X', 'Y', 'W']) {
      expect(matchHeader(h).field).toBeNull();
    }
  });
});

describe('number parsing', () => {
  it('reads the European decimal comma', () => {
    expect(parseNumber('73,5')).toBe(73.5);
    expect(parseNumber('592,5')).toBe(592.5);
  });

  it('tells a thousands separator from a decimal comma', () => {
    expect(parseNumber('1,012')).toBe(1012);
    expect(parseNumber('73,5')).toBe(73.5);
  });

  it('averages an adjustable range and does not invent a single value', () => {
    expect(parseNumber('410-425')).toBe(417.5);
    expect(parseNumber('410–425')).toBe(417.5);
  });

  it('strips footnote and approximation markers', () => {
    expect(parseNumber('570*')).toBe(570);
    expect(parseNumber('~575')).toBe(575);
  });

  it('returns null for an absent value, never zero', () => {
    // Coercing a missing chainstay to 0 would silently produce a wrong bike.
    for (const s of ['n/a', 'N/A', '-', '—', '', '  ']) {
      expect(parseNumber(s)).toBeNull();
    }
  });
});

describe('splitting a pasted table', () => {
  const tabbed = 'Size\t49\t52\t54\nStack\t509\t522\t535\nReach\t366\t375\t380';

  it('handles tab-separated text, which is what copying a web table produces', () => {
    const t = splitPaste(tabbed);
    expect(t?.headers).toEqual(['Size', '49', '52', '54']);
    expect(t?.rows).toHaveLength(2);
  });

  it('rejects anything that is not a table', () => {
    expect(splitPaste('just one line')).toBeNull();
  });
});

describe('orientation detection', () => {
  it('finds sizes across the top', () => {
    const t = splitPaste('Size\t49\t52\t54\nStack\t509\t522\t535')!;
    expect(detectOrientation(t)).toBe('sizesAsColumns');
  });

  it('finds sizes down the side', () => {
    const t = splitPaste('Size\tStack\tReach\n49\t509\t366\n52\t522\t375\n54\t535\t380')!;
    expect(detectOrientation(t)).toBe('sizesAsRows');
  });

  it('transposes a column-oriented table so one row is one size', () => {
    const t = toSizeRows(splitPaste('Size\t49\t52\nStack\t509\t522\nReach\t366\t375')!);
    expect(t.headers).toEqual(['Size', 'Stack', 'Reach']);
    expect(t.rows).toEqual([['49', '509', '366'], ['52', '522', '375']]);
  });
});

describe('legend parsing unlocks letter-column tables', () => {
  // Verbatim from pinarello.com — the exact case that made the header matcher
  // give up, and the exact thing that makes it solvable.
  const PINARELLO_LEGEND =
    'CE: SEAT TUBE CENTER - END, CC: SEAT TUBE CENTER - CENTER, L: TOP TUBE CENTER - CENTER, ' +
    'A[°]: SEAT TUBE ANGLE, B[°]: HEADTUBE ANGLE, P: CHAINSTAY, T: HEADTUBE, D: BB DROP, ' +
    'R: FORK RAKE , G: FORK HEIGHT, REACH, STACK';

  it('maps the letters that carry meaning', () => {
    const legend = parseLegend(PINARELLO_LEGEND);
    expect(legend['a']).toBe('seatTubeAngle');
    expect(legend['b']).toBe('headTubeAngle');
    expect(legend['p']).toBe('chainstay');
    expect(legend['t']).toBe('headTubeLength');
    expect(legend['d']).toBe('bbDrop');
    expect(legend['r']).toBe('forkRake');
  });

  it('leaves letters it cannot map alone rather than forcing a match', () => {
    const legend = parseLegend(PINARELLO_LEGEND);
    // "Fork height" is not a field this model uses; inventing a home for it
    // would be worse than dropping it.
    expect(legend['g']).toBeUndefined();
  });

  it('resolves a letter header only once the legend is supplied', () => {
    const legend = parseLegend(PINARELLO_LEGEND);
    expect(matchHeader('B [°]').field).toBeNull();
    expect(matchHeaderWithLegend('B [°]', legend).field).toBe('headTubeAngle');
  });

  it('still refuses unknown letters even with a legend present', () => {
    const legend = parseLegend(PINARELLO_LEGEND);
    expect(matchHeaderWithLegend('Q7', legend).field).toBeNull();
  });
});

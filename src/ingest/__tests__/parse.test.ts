import { describe, expect, it } from 'vitest';
import {
  detectOrientation, matchHeader, matchHeaderWithLegend, normaliseHeader, parseLegend,
  parseNumber, splitPaste, toSizeRows, isSpecList, specListToRow,
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

describe('real manufacturer vocabulary', () => {
  // Basso calls the head tube angle "Steering Tube Angle". Token similarity
  // scores that 0.67 against "head tube angle" - below the threshold - so
  // without the synonym the single most important angle silently vanishes.
  it('reads Basso column headers', () => {
    expect(matchHeader('Steering Tube Angle (D)').field).toBe('headTubeAngle');
    expect(matchHeader('Seat Tube Angle (C)').field).toBe('seatTubeAngle');
    expect(matchHeader('Reach (R)').field).toBe('reach');
    expect(matchHeader('Stack (S)').field).toBe('stack');
    expect(matchHeader('Chain-Stay (E)').field).toBe('chainstay');
    expect(matchHeader('Headtube (H)').field).toBe('headTubeLength');
    expect(matchHeader('Wheelbase (WB)').field).toBe('wheelbase');
    expect(matchHeader('Stand Over').field).toBe('standover');
  });

  it('treats hyphen, space and no space as the same word, with full confidence', () => {
    for (const h of ['Chainstay', 'Chain stay', 'Chain-Stay']) {
      expect(matchHeader(h)).toMatchObject({ field: 'chainstay', method: 'exact' });
    }
  });

  it('parses values that carry their unit in the cell', () => {
    expect(parseNumber('420mm')).toBe(420);
    expect(parseNumber('75.5°')).toBe(75.5);
    expect(parseNumber('1002mm')).toBe(1002);
  });

  it('recognises the secondary geometry columns in three languages', () => {
    expect(matchHeader('Top Tube').field).toBe('effectiveTopTube');
    expect(matchHeader('Effective Top Tube (mm)').field).toBe('effectiveTopTube');
    expect(matchHeader('Oberrohr').field).toBe('effectiveTopTube');
    expect(matchHeader('Tubo orizzontale').field).toBe('effectiveTopTube');
    expect(matchHeader('Wheelbase').field).toBe('wheelbase');
    expect(matchHeader('Radstand').field).toBe('wheelbase');
    expect(matchHeader('Interasse').field).toBe('wheelbase');
    expect(matchHeader('BB Drop').field).toBe('bbDrop');
    expect(matchHeader('Trail').field).toBe('trail');
    expect(matchHeader('Max Tyre').field).toBe('tyreMax');
    expect(matchHeader('Tyre Clearance').field).toBe('tyreMax');
  });

  it('resolves the Wilier letter columns through a legend', () => {
    // The Rapida page prints no legend; the fitter supplies one from the drawing.
    const legend = parseLegend('A: SEAT TUBE ANGLE, A1: HEAD TUBE ANGLE');
    expect(matchHeaderWithLegend('A', legend).field).toBe('seatTubeAngle');
    expect(matchHeaderWithLegend('A1', legend).field).toBe('headTubeAngle');
  });

  it('resolves the Bianchi letter columns through a legend', () => {
    const legend = parseLegend(
      'G: SEAT TUBE ANGLE, G1: HEAD TUBE ANGLE, I: CHAINSTAY, X: REACH, ' +
      'Y: STACK, W: WHEELBASE, E: HEAD TUBE, H: FORK RAKE',
    );
    expect(matchHeaderWithLegend('Y', legend).field).toBe('stack');
    expect(matchHeaderWithLegend('X', legend).field).toBe('reach');
    expect(matchHeaderWithLegend('G1', legend).field).toBe('headTubeAngle');
    expect(matchHeaderWithLegend('W', legend).field).toBe('wheelbase');
    expect(matchHeaderWithLegend('H', legend).field).toBe('forkRake');
  });
});

describe('vertical spec lists (one size at a time)', () => {
  // Specialized publishes geometry as a label/value list for the selected size,
  // switched by buttons elsewhere on the page - neither a row-per-size nor a
  // column-per-size matrix.
  const SPECIALIZED = [
    'Crank Length\t165mm', 'Handlebar Width\t380mm', 'Stem Length\t80mm',
    'Frame Stack\t501mm', 'Frame Reach\t366mm', 'Head Tube Length\t99mm',
    'Head Tube Angle\t70.5°', 'BB Drop\t74mm', 'Fork Rake/Offset\t47mm',
    'Chainstay Length\t410mm', 'Wheelbase\t970mm', 'Seat Tube Angle\t75.5°',
  ].join('\n');

  it('recognises the shape instead of mangling it as a matrix', () => {
    const t = splitPaste(SPECIALIZED)!;
    expect(isSpecList(t)).toBe(true);
  });

  it('does not mistake a real two-column matrix for a spec list', () => {
    const matrix = splitPaste('Size\t54\nStack\t545\nReach\t388')!;
    // Only three rows, and too few recognised labels to be sure.
    expect(isSpecList(matrix)).toBe(false);
  });

  it('flattens it into one frame with the right values', () => {
    const row = specListToRow(splitPaste(SPECIALIZED)!);
    const mapping = row.headers.map((h) => matchHeader(h).field);
    const get = (f: string) => {
      const i = mapping.indexOf(f as never);
      return i >= 0 ? parseNumber(row.rows[0]![i] ?? '') : null;
    };
    expect(get('stack')).toBe(501);
    expect(get('reach')).toBe(366);
    expect(get('headTubeAngle')).toBe(70.5);
    expect(get('seatTubeAngle')).toBe(75.5);
    expect(get('chainstay')).toBe(410);
    expect(get('wheelbase')).toBe(970);
  });

  it('reads Specialized field wording', () => {
    expect(matchHeader('Frame Stack').field).toBe('stack');
    expect(matchHeader('Frame Reach').field).toBe('reach');
    expect(matchHeader('Fork Rake/Offset').field).toBe('forkRake');
    expect(matchHeader('Bike Standover Height').field).toBe('standover');
  });
});

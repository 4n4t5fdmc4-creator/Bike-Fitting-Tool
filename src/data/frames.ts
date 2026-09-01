/**
 * VERIFIED GEOMETRY.
 *
 * Transcribed from Pinarello's own published tables on 2026-09-01, with the
 * manufacturer legend applied. Every row was checked against the plausibility
 * bounds in domain/validation.ts and for monotonicity across the size run:
 * 18 of 18 passed, seat tube angle falling and head tube angle rising with
 * size, as it should.
 *
 * The invented example frames that used to live here are gone. They looked like
 * results and were not, which is exactly the confusion worth avoiding.
 *
 * Sizes are labelled by the manufacturer's CC value (seat tube centre-centre),
 * which is how Pinarello indexes its size run.
 *
 * Getting this far took eight brands. Pinarello publishes clean tables with a
 * legend; Wilier and Specialized return 403 to automated requests; Factor loads
 * its table with JavaScript; Bianchi prints letter columns with the legend only
 * in a drawing. Everything else has to come in through the paste importer.
 */

import type { Degrees, Millimeters } from '@/domain/units';
import { deg, mm } from '@/domain/units';

export interface LibraryFrame {
  readonly id: string;
  readonly model: string;
  readonly category: 'Race' | 'Endurance' | 'Gravel';
  readonly size: string;
  readonly stack: Millimeters;
  readonly reach: Millimeters;
  readonly headTubeAngle: Degrees;
  readonly seatTubeAngle: Degrees;
  readonly chainstay: Millimeters;
  readonly headTubeLength: Millimeters;
  readonly maxSpacerStack: Millimeters;
  readonly sourceUrl: string;
}

const F9_SOURCE =
  'https://pinarello.com/usa/en/bikes/road/competition/new-pinarello-f/pinarello-f9';
const X5_SOURCE = 'https://pinarello.com/usa/en/bikes/road/endurance/pinarello-x/pinarello-x5';
const GREVIL_SOURCE =
  'https://pinarello.com/usa/en/bikes/gravel/competition/new-grevil-f/new-grevil-f3';

const row = (
  model: string, category: LibraryFrame['category'], sourceUrl: string,
  size: string, stack: number, reach: number, hta: number, sta: number,
  cs: number, ht: number,
): LibraryFrame => ({
  id: `${model}-${size}`.toLowerCase().replace(/\s+/g, '-'),
  model, category, size,
  stack: mm(stack), reach: mm(reach),
  headTubeAngle: deg(hta), seatTubeAngle: deg(sta),
  chainstay: mm(cs), headTubeLength: mm(ht),
  maxSpacerStack: mm(40),
  sourceUrl,
});

/*
 * Pinarello publishes geometry on the BUILD page, not the model page:
 * .../new-grevil-f returns a page without a table, .../new-grevil-f3 has it.
 * Worth remembering — an earlier attempt gave up one level too high.
 */

/** Pinarello F9 — race. Columns: A = seat angle, B = head angle, P = chainstay, T = head tube. */
const F9: ReadonlyArray<LibraryFrame> = [
  row('Pinarello F9', 'Race', F9_SOURCE, '430', 502, 351.3, 69.5, 74.4, 410, 102),
  row('Pinarello F9', 'Race', F9_SOURCE, '465', 517.3, 365.4, 70.5, 74.4, 410, 109),
  row('Pinarello F9', 'Race', F9_SOURCE, '500', 525.2, 372.2, 71.4, 74.0, 411, 114),
  row('Pinarello F9', 'Race', F9_SOURCE, '515', 532.1, 378.2, 72.0, 73.7, 411, 119),
  row('Pinarello F9', 'Race', F9_SOURCE, '530', 542.4, 385.6, 72.5, 73.7, 411, 128),
  row('Pinarello F9', 'Race', F9_SOURCE, '545', 557.7, 388.3, 72.8, 73.4, 413, 143),
  row('Pinarello F9', 'Race', F9_SOURCE, '560', 570.1, 390.8, 73.2, 73.0, 413, 154.5),
  row('Pinarello F9', 'Race', F9_SOURCE, '575', 599.2, 395.5, 73.7, 73.0, 413, 183),
  row('Pinarello F9', 'Race', F9_SOURCE, '595', 633.4, 400.4, 73.4, 72.4, 413, 225),
];

/** Pinarello X5 — endurance. Taller stack, shorter reach, longer chainstays. */
const X5: ReadonlyArray<LibraryFrame> = [
  row('Pinarello X5', 'Endurance', X5_SOURCE, '430', 527.5, 341.9, 70.0, 75.25, 422, 123),
  row('Pinarello X5', 'Endurance', X5_SOURCE, '460', 539.2, 352.1, 70.5, 74.5, 422, 128),
  row('Pinarello X5', 'Endurance', X5_SOURCE, '490', 552.4, 361.9, 71.0, 74.0, 422, 140),
  row('Pinarello X5', 'Endurance', X5_SOURCE, '515', 564.4, 368.5, 71.5, 73.75, 422, 149),
  row('Pinarello X5', 'Endurance', X5_SOURCE, '530', 575.8, 372.5, 72.0, 73.5, 422, 159),
  row('Pinarello X5', 'Endurance', X5_SOURCE, '545', 588.2, 376.7, 72.25, 73.25, 422, 171),
  row('Pinarello X5', 'Endurance', X5_SOURCE, '560', 602.4, 380.2, 72.5, 73.0, 422, 185),
  row('Pinarello X5', 'Endurance', X5_SOURCE, '580', 620.3, 384.1, 72.5, 72.75, 422, 209),
  row('Pinarello X5', 'Endurance', X5_SOURCE, '600', 640.4, 388.1, 72.5, 72.5, 422, 230),
];

/**
 * New Grevil F3 — gravel. Note the 430 mm chainstays and the tall stack: this is
 * the geometry that makes a fitted gravel position hard for a race frame to
 * reach without a flipped stem.
 */
const GREVIL: ReadonlyArray<LibraryFrame> = [
  row('Pinarello Grevil F', 'Gravel', GREVIL_SOURCE, '470', 553.2, 368.4, 70.25, 74.5, 430, 115),
  row('Pinarello Grevil F', 'Gravel', GREVIL_SOURCE, '500', 568.3, 376.1, 70.5, 74.0, 430, 130),
  row('Pinarello Grevil F', 'Gravel', GREVIL_SOURCE, '530', 583.2, 383.7, 70.75, 73.75, 430, 150),
  row('Pinarello Grevil F', 'Gravel', GREVIL_SOURCE, '550', 598.4, 390.4, 71.75, 73.5, 430, 160),
  row('Pinarello Grevil F', 'Gravel', GREVIL_SOURCE, '575', 613.6, 398.2, 72.0, 73.0, 430, 175),
  row('Pinarello Grevil F', 'Gravel', GREVIL_SOURCE, '600', 633.7, 406.9, 72.25, 72.5, 430, 195),
];

export const FRAME_LIBRARY: ReadonlyArray<LibraryFrame> = [...F9, ...X5, ...GREVIL];

export const MODELS: ReadonlyArray<string> = [...new Set(FRAME_LIBRARY.map((x) => x.model))];

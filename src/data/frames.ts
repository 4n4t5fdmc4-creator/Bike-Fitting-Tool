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

import type { Degrees, Millimeters } from '../domain/units';
import { deg, mm } from '../domain/units';

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

  /**
   * Secondary geometry, all optional. A manufacturer table publishes a
   * different subset for every brand, so nothing here can be required - the
   * outline and the comparison fall back to a typical value and say so when a
   * field is absent. Millimetres unless the name says otherwise.
   */
  readonly effectiveTopTube?: Millimeters;
  readonly wheelbase?: Millimeters;
  readonly bbDrop?: Millimeters;
  readonly forkRake?: Millimeters;
  readonly tyreMax?: Millimeters;
  readonly standover?: Millimeters;
  readonly trail?: Millimeters;

  /** The cockpit the bike ships with, for the "cheapest change" comparison. */
  readonly stockStem?: Millimeters;
  readonly stockStemAngle?: Degrees;
  readonly stockSpacers?: Millimeters;
  readonly cockpitType?: 'open' | 'semi-integrated' | 'integrated';
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
  extra: Partial<LibraryFrame> = {},
): LibraryFrame => ({
  id: `${model}-${size}`.toLowerCase().replace(/\s+/g, '-'),
  model, category, size,
  stack: mm(stack), reach: mm(reach),
  headTubeAngle: deg(hta), seatTubeAngle: deg(sta),
  chainstay: mm(cs), headTubeLength: mm(ht),
  maxSpacerStack: mm(40),
  sourceUrl,
  ...extra,
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

const SV_SOURCE = 'https://bassobikes.com/en/bikes/road-bikes/sv';

/**
 * Basso SV — aero race, seven sizes. Transcribed from bassobikes.com on
 * 2026-09-01. The page prints TWO columns headed "Chain-Stay": E (~406 mm) is
 * the real chainstay, F (~575 mm) is front centre — F has no field and is not
 * stored. Tyre clearance (35 mm) is a frame-wide figure, confirmed against the
 * SV launch coverage. Seat tube length (A1) and the sloping figure (S') are
 * dropped for the same reason. Every row checked against validation.ts bounds
 * and for monotonicity across the run.
 */
const SV: ReadonlyArray<LibraryFrame> = [
  row('Basso SV', 'Race', SV_SOURCE, '45', 520, 370, 71.2, 75.5, 406, 115, { effectiveTopTube: mm(505), wheelbase: mm(971), standover: mm(722), tyreMax: mm(35) }),
  row('Basso SV', 'Race', SV_SOURCE, '48', 521, 375, 71.5, 75.0, 406, 115, { effectiveTopTube: mm(515), wheelbase: mm(974), standover: mm(744), tyreMax: mm(35) }),
  row('Basso SV', 'Race', SV_SOURCE, '51', 547, 380, 72.0, 74.7, 406, 140, { effectiveTopTube: mm(530), wheelbase: mm(982), standover: mm(772), tyreMax: mm(35) }),
  row('Basso SV', 'Race', SV_SOURCE, '53', 560, 385, 72.5, 74.0, 406, 152, { effectiveTopTube: mm(546), wheelbase: mm(987), standover: mm(789), tyreMax: mm(35) }),
  row('Basso SV', 'Race', SV_SOURCE, '56', 584, 387, 73.0, 73.5, 408, 170, { effectiveTopTube: mm(560), wheelbase: mm(991), standover: mm(810), tyreMax: mm(35) }),
  row('Basso SV', 'Race', SV_SOURCE, '58', 609, 389, 73.5, 73.0, 412, 194, { effectiveTopTube: mm(575), wheelbase: mm(999), standover: mm(830), tyreMax: mm(35) }),
  row('Basso SV', 'Race', SV_SOURCE, '61', 634, 390, 74.0, 72.5, 412, 218, { effectiveTopTube: mm(590), wheelbase: mm(1002), standover: mm(857), tyreMax: mm(35) }),
];

const RAPIDA_SOURCE = 'https://wilier.com/en/bikes/road/rapida';

/**
 * Wilier Rapida — all-road, six sizes (XS…XXL). Transcribed from wilier.com on
 * 2026-09-01. The page has no legend; the column letters are only in the
 * drawing. Applied: L = horizontal top tube, H1 = head tube, L1 = chainstay
 * (all printed in CENTIMETRES, converted here), A = seat tube angle, A1 = head
 * tube angle. C/C and H are seat tube lengths (no field). Rows checked against
 * validation.ts bounds and for monotonicity across the run.
 */
const RAPIDA: ReadonlyArray<LibraryFrame> = [
  row('Wilier Rapida', 'Endurance', RAPIDA_SOURCE, 'XS', 520, 372, 70.5, 75.5, 410, 108, { effectiveTopTube: mm(509), wheelbase: mm(981), standover: mm(732) }),
  row('Wilier Rapida', 'Endurance', RAPIDA_SOURCE, 'S', 538, 378, 71.3, 75.0, 410, 125, { effectiveTopTube: mm(524), wheelbase: mm(986), standover: mm(758) }),
  row('Wilier Rapida', 'Endurance', RAPIDA_SOURCE, 'M', 556, 384.5, 72.0, 74.0, 412, 143, { effectiveTopTube: mm(545), wheelbase: mm(994), standover: mm(782) }),
  row('Wilier Rapida', 'Endurance', RAPIDA_SOURCE, 'L', 574, 390, 72.0, 74.0, 412, 162, { effectiveTopTube: mm(556), wheelbase: mm(1006), standover: mm(808) }),
  row('Wilier Rapida', 'Endurance', RAPIDA_SOURCE, 'XL', 592, 396, 72.0, 73.0, 414, 183, { effectiveTopTube: mm(578), wheelbase: mm(1021), standover: mm(832) }),
  row('Wilier Rapida', 'Endurance', RAPIDA_SOURCE, 'XXL', 610, 402, 72.0, 73.0, 414, 202, { effectiveTopTube: mm(589), wheelbase: mm(1033), standover: mm(856) }),
];

const SL9_SOURCE =
  'https://www.specialized.com/us/en/tarmac-sl9-expert-sram-force-axs/p/4293530';

/**
 * Specialized Tarmac SL9 — race, seven sizes. Transcribed from specialized.com
 * on 2026-09-01, one vertical spec list per size. `stockStem` and the open
 * cockpit are the Expert / SRAM Force AXS build the geometry page belongs to;
 * the frameset itself also takes the integrated cockpit. Seat tube length,
 * front centre, BB height and fork length have no field and are dropped. Rows
 * checked against validation.ts bounds and for monotonicity across the run.
 */
const SL9: ReadonlyArray<LibraryFrame> = [
  row('Specialized Tarmac SL9', 'Race', SL9_SOURCE, '44', 501, 366, 70.5, 75.5, 410, 99, { effectiveTopTube: mm(496), wheelbase: mm(970), bbDrop: mm(74), forkRake: mm(47), trail: mm(71), standover: mm(722), stockStem: mm(80), cockpitType: 'open' }),
  row('Specialized Tarmac SL9', 'Race', SL9_SOURCE, '49', 514, 375, 71.75, 75.5, 410, 109, { effectiveTopTube: mm(509), wheelbase: mm(973), bbDrop: mm(74), forkRake: mm(47), trail: mm(63), standover: mm(734), stockStem: mm(80), cockpitType: 'open' }),
  row('Specialized Tarmac SL9', 'Race', SL9_SOURCE, '52', 527, 380, 72.5, 74.0, 410, 120, { effectiveTopTube: mm(531), wheelbase: mm(975), bbDrop: mm(74), forkRake: mm(47), trail: mm(58), standover: mm(745), stockStem: mm(90), cockpitType: 'open' }),
  row('Specialized Tarmac SL9', 'Race', SL9_SOURCE, '54', 544, 384, 72.5, 74.0, 410, 140, { effectiveTopTube: mm(540), wheelbase: mm(986), bbDrop: mm(72), forkRake: mm(47), trail: mm(58), standover: mm(767), stockStem: mm(100), cockpitType: 'open' }),
  row('Specialized Tarmac SL9', 'Race', SL9_SOURCE, '56', 565, 395, 73.5, 73.5, 410, 157, { effectiveTopTube: mm(563), wheelbase: mm(991), bbDrop: mm(72), forkRake: mm(44), trail: mm(55), standover: mm(785), stockStem: mm(100), cockpitType: 'open' }),
  row('Specialized Tarmac SL9', 'Race', SL9_SOURCE, '58', 591, 402, 73.5, 73.5, 410, 184, { effectiveTopTube: mm(577), wheelbase: mm(1006), bbDrop: mm(72), forkRake: mm(44), trail: mm(55), standover: mm(807), stockStem: mm(110), cockpitType: 'open' }),
  row('Specialized Tarmac SL9', 'Race', SL9_SOURCE, '61', 612, 408, 74.0, 73.0, 410, 204, { effectiveTopTube: mm(595), wheelbase: mm(1013), bbDrop: mm(72), forkRake: mm(44), trail: mm(52), standover: mm(833), stockStem: mm(110), cockpitType: 'open' }),
];

const INFINITO_SOURCE = 'https://www.bianchi.com/en/infinito/';

/**
 * Bianchi Infinito — endurance, seven sizes. Transcribed from bianchi.com on
 * 2026-09-01. Letter columns keyed to a drawing: B1 = horizontal top tube,
 * C = chainstay, D = BB drop, E = head tube, G = seat tube angle, G1 = head
 * tube angle, H = fork rake, X = reach, Y = stack, W = wheelbase.
 *
 * NOTE the build-prompt legend named column `I` as the chainstay; `I` is a
 * constant 385 mm across every size (fork axle-to-crown, no field for it), and
 * `C` at 420-424 mm is the chainstay that actually varies with size and matches
 * Bianchi's published figures. A = seat tube length and F = front centre are
 * dropped. Rows checked against validation.ts bounds and for monotonicity.
 */
const INFINITO: ReadonlyArray<LibraryFrame> = [
  row('Bianchi Infinito', 'Endurance', INFINITO_SOURCE, '470', 531, 370, 70.5, 75.0, 420, 115, { effectiveTopTube: mm(512), wheelbase: mm(990), bbDrop: mm(73), forkRake: mm(42) }),
  row('Bianchi Infinito', 'Endurance', INFINITO_SOURCE, '500', 552, 372, 71.0, 74.5, 422, 135, { effectiveTopTube: mm(525), wheelbase: mm(997), bbDrop: mm(73), forkRake: mm(42) }),
  row('Bianchi Infinito', 'Endurance', INFINITO_SOURCE, '530', 566, 373, 71.0, 74.0, 422, 150, { effectiveTopTube: mm(535), wheelbase: mm(1002), bbDrop: mm(73), forkRake: mm(42) }),
  row('Bianchi Infinito', 'Endurance', INFINITO_SOURCE, '550', 584, 377, 72.0, 73.5, 422, 165, { effectiveTopTube: mm(550), wheelbase: mm(1003), bbDrop: mm(73), forkRake: mm(42) }),
  row('Bianchi Infinito', 'Endurance', INFINITO_SOURCE, '570', 600, 382, 72.5, 73.5, 422, 180, { effectiveTopTube: mm(560), wheelbase: mm(1008), bbDrop: mm(73), forkRake: mm(42) }),
  row('Bianchi Infinito', 'Endurance', INFINITO_SOURCE, '590', 614.5, 384, 72.5, 73.0, 424, 195, { effectiveTopTube: mm(572), wheelbase: mm(1017), bbDrop: mm(73), forkRake: mm(42) }),
  row('Bianchi Infinito', 'Endurance', INFINITO_SOURCE, '610', 629, 387, 72.5, 72.5, 424, 210, { effectiveTopTube: mm(585), wheelbase: mm(1024), bbDrop: mm(73), forkRake: mm(42) }),
];

export const FRAME_LIBRARY: ReadonlyArray<LibraryFrame> = [
  ...F9, ...X5, ...GREVIL, ...SV, ...RAPIDA, ...SL9, ...INFINITO,
];

export const MODELS: ReadonlyArray<string> = [...new Set(FRAME_LIBRARY.map((x) => x.model))];

/**
 * EXAMPLE FRAME DATA.
 *
 * These are realistic, internally consistent geometries across typical size
 * runs - they are NOT manufacturer data and no bike is named. Replace them with
 * real geometry tables via the ingestion pipeline (docs/ingestion-pipeline.md).
 *
 * The UI must say this out loud wherever these are shown. A plausible-looking
 * number the rider believes is worse than no number.
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
  /** Manufacturer spacer ceiling, where stated. */
  readonly maxSpacerStack: Millimeters;
}

const f = (
  model: LibraryFrame['model'], category: LibraryFrame['category'], size: string,
  stack: number, reach: number, hta: number, sta: number, maxSpacer = 40,
): LibraryFrame => ({
  id: `${model}-${size}`.toLowerCase().replace(/\s+/g, '-'),
  model, category, size,
  stack: mm(stack), reach: mm(reach),
  headTubeAngle: deg(hta), seatTubeAngle: deg(sta),
  maxSpacerStack: mm(maxSpacer),
});

export const FRAME_LIBRARY: ReadonlyArray<LibraryFrame> = [
  // A racy geometry: low stack, long reach, steep head angles.
  f('Aero Race', 'Race', '49', 505, 372, 71.5, 74.5, 30),
  f('Aero Race', 'Race', '52', 525, 380, 72.5, 74.0, 30),
  f('Aero Race', 'Race', '54', 545, 388, 73.0, 73.5, 30),
  f('Aero Race', 'Race', '56', 565, 395, 73.5, 73.0, 30),
  f('Aero Race', 'Race', '58', 585, 403, 73.5, 73.0, 30),
  f('Aero Race', 'Race', '61', 610, 413, 73.5, 72.5, 30),

  // Endurance: taller front end, slacker head angles, longer head tubes.
  f('Endurance', 'Endurance', '48', 530, 371, 70.5, 74.5),
  f('Endurance', 'Endurance', '51', 552, 376, 71.0, 74.0),
  f('Endurance', 'Endurance', '54', 570, 380, 71.5, 73.5),
  f('Endurance', 'Endurance', '56', 592, 387, 72.0, 73.0),
  f('Endurance', 'Endurance', '58', 613, 393, 72.5, 73.0),
  f('Endurance', 'Endurance', '61', 640, 400, 72.5, 72.5),

  // Gravel: taller again, slacker, shorter reach for the same stack.
  f('Gravel', 'Gravel', 'XS', 545, 370, 70.0, 74.0, 50),
  f('Gravel', 'Gravel', 'S', 570, 376, 70.5, 73.5, 50),
  f('Gravel', 'Gravel', 'M', 595, 383, 71.0, 73.5, 50),
  f('Gravel', 'Gravel', 'L', 620, 390, 71.5, 73.0, 50),
  f('Gravel', 'Gravel', 'XL', 650, 398, 71.5, 72.5, 50),

  // A deliberately upright frame, to show what a bad match looks like.
  f('Comfort', 'Endurance', 'M', 630, 378, 70.0, 74.0),
  f('Comfort', 'Endurance', 'L', 660, 385, 70.5, 73.5),
  f('Comfort', 'Endurance', 'XL', 690, 392, 70.5, 73.0),
];

export const MODELS: ReadonlyArray<string> = [
  ...new Set(FRAME_LIBRARY.map((x) => x.model)),
];

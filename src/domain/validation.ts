/**
 * Validation rules and documented default values.
 *
 * Two severities, and the distinction is load-bearing:
 *   - `error`   the value cannot be used; computation stops.
 *   - `warning` the value is usable but implausible; compute, and say so.
 *
 * Almost everything here is a warning. A rider who mistypes their inseam by
 * 10 mm should get a nudge, not a locked form.
 */

import type { Millimeters, Degrees } from './units';
import { mm, deg, sourced } from './units';
import type { FitAssumptions } from './fit';

export type Severity = 'error' | 'warning';

export interface ValidationIssue {
  readonly code: string;
  readonly field: string;
  readonly severity: Severity;
  readonly message: string;
}

export interface Range<T> {
  readonly min: T;
  readonly max: T;
}

/**
 * Plausible ranges. Outside `hard` is an error; outside `soft` is a warning.
 * The soft band is where real riders live; the hard band is where a value stops
 * describing a human on a bicycle.
 */
export interface Bounds<T> {
  readonly soft: Range<T>;
  readonly hard: Range<T>;
}

const bounds = (
  softMin: number,
  softMax: number,
  hardMin: number,
  hardMax: number,
): Bounds<Millimeters> => ({
  soft: { min: mm(softMin), max: mm(softMax) },
  hard: { min: mm(hardMin), max: mm(hardMax) },
});

const angleBounds = (
  softMin: number,
  softMax: number,
  hardMin: number,
  hardMax: number,
): Bounds<Degrees> => ({
  soft: { min: deg(softMin), max: deg(softMax) },
  hard: { min: deg(hardMin), max: deg(hardMax) },
});

/** Body measurements, in millimetres. */
export const BODY_BOUNDS = {
  height: bounds(1500, 2000, 1200, 2200),
  inseam: bounds(680, 950, 550, 1100),
  torso: bounds(500, 700, 400, 800),
  arm: bounds(550, 750, 450, 850),
  shoulderWidth: bounds(340, 480, 280, 560),
  sitBoneWidth: bounds(95, 160, 80, 200),
  footLength: bounds(230, 320, 200, 360),
} as const;

/** Frame geometry, in millimetres and degrees. */
export const FRAME_BOUNDS = {
  stack: bounds(480, 680, 400, 800),
  reach: bounds(340, 430, 300, 500),
  headTubeAngle: angleBounds(68, 75, 63, 80),
  seatTubeAngle: angleBounds(70, 76, 65, 82),
  headTubeLength: bounds(90, 250, 60, 350),
  seatTubeLength: bounds(400, 620, 300, 700),
  chainstayLength: bounds(395, 460, 360, 520),
  wheelbase: bounds(950, 1100, 880, 1300),
  bbDrop: bounds(60, 85, 40, 100),
  forkRake: bounds(40, 55, 30, 70),
  standover: bounds(650, 900, 550, 1000),
} as const;

/** Components, in millimetres and degrees. */
export const COMPONENT_BOUNDS = {
  stemLength: bounds(70, 130, 35, 160),
  stemAngle: angleBounds(-17, 17, -40, 40),
  spacerStack: bounds(0, 40, 0, 80),
  handlebarReach: bounds(70, 100, 50, 130),
  handlebarDrop: bounds(115, 145, 90, 200),
  handlebarRise: bounds(0, 40, 0, 100),
  handlebarWidth: bounds(360, 460, 300, 800),
  seatpostSetback: bounds(0, 25, -10, 40),
  saddleWidthPointOffset: bounds(45, 95, 20, 130),
  saddleHeight: bounds(620, 830, 500, 950),
  crankLength: bounds(160, 180, 140, 200),
} as const;

/**
 * Cross-field rules. These catch the errors that individually-plausible values
 * produce together, which is where the real mistakes live.
 */
export interface CrossFieldRule {
  readonly code: string;
  readonly severity: Severity;
  readonly description: string;
}

export const CROSS_FIELD_RULES: ReadonlyArray<CrossFieldRule> = [
  {
    code: 'inseamExceedsHeight',
    severity: 'error',
    description: 'Inseam must be between 40% and 60% of height. Outside that, one of the two is wrong - almost always a trouser inseam entered instead of a measured one.',
  },
  {
    code: 'saddleHeightVsInseam',
    severity: 'warning',
    description: 'Saddle height outside 0.80-0.95 x inseam. Valid for some riders, but worth confirming.',
  },
  {
    code: 'standoverExceedsInseam',
    severity: 'error',
    description: 'Standover height must be at least 20 mm below inseam. Otherwise the rider cannot stand over the bike.',
  },
  {
    code: 'wheelbaseVsChainstay',
    severity: 'error',
    description: 'Wheelbase must exceed chainstay length. A violation means the two came from different rows of a geometry table.',
  },
  {
    code: 'stackReachRatio',
    severity: 'warning',
    description: 'Stack/reach outside 1.28-1.65. Valid for TT and some MTB geometry, implausible for a drop-bar road frame.',
  },
  {
    code: 'seatpostBelowMinInsertion',
    severity: 'error',
    description: 'Required saddle height leaves the post inserted less than its marked minimum. A structural limit, not a fit preference.',
  },
  {
    code: 'railOffsetExceedsTravel',
    severity: 'error',
    description: 'Required saddle fore/aft exceeds the rails. Needs a different seatpost setback, not a different adjustment.',
  },
  {
    code: 'spacersExceedFrameMax',
    severity: 'error',
    description: 'Required spacer stack exceeds the frame maximum. Structural on carbon steerers - the model refuses rather than extrapolating.',
  },
  {
    code: 'effectiveSeatAngleUsed',
    severity: 'warning',
    description: 'Only an effective seat tube angle was available. Saddle setback carries roughly +-15 mm of additional uncertainty.',
  },
  {
    code: 'unknownSaddleModel',
    severity: 'warning',
    description: 'Saddle 70 mm width point offset defaulted. Reach figures carry roughly +-15 mm of additional uncertainty.',
  },
  {
    code: 'integratedCockpitLimited',
    severity: 'warning',
    description: 'Cockpit is integrated. Only the manufacturer catalogue is available, so the optimiser has far less freedom than on a conventional frame.',
  },
];

/**
 * Default assumptions. Every value here is wrong for someone, which is why each
 * carries its provenance and appears in the UI rather than staying hidden.
 *
 * Sigmas are half-widths of the plausible range, not measurement error.
 */
export const DEFAULT_ASSUMPTIONS: FitAssumptions = {
  // Modern hydraulic hoods. Mechanical levers of the 2010s sit ~25/10.
  hoodForward: sourced(mm(35), 'default', 8, 'Modern hydraulic lever. Older mechanical levers sit ~10 mm further back.'),
  hoodRise: sourced(mm(20), 'default', 6),

  // Modern compact bar. Classic bars reach to 100 mm.
  barReach: sourced(mm(80), 'default', 10, 'Compact bar assumed. A classic bend adds up to 20 mm of reach.'),
  barDrop: sourced(mm(128), 'default', 10),
  barRotation: sourced(deg(0), 'default', 3),

  // Headset top cap plus compression ring - part of the stack, never counted
  // by riders reporting "20 mm of spacers".
  topCapHeight: sourced(mm(10), 'default', 4),
  maxSpacerStack: sourced(mm(40), 'default', 10, 'Common carbon steerer limit where the manufacturer states none.'),
  stemClampHeight: sourced(mm(40), 'default', 6),

  saddleWidthPointOffset: sourced(mm(40), 'default', 8, 'Saddle model unknown. Measure the 70 mm width point to remove this.'),
  saddleRailToTop: sourced(mm(35), 'default', 5),

  wheelRadius: sourced(mm(350), 'default', 10, '700c with a 28 mm tyre.'),
};

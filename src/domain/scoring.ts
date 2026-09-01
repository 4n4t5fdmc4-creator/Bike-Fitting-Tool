/**
 * Scoring and explanation.
 *
 * The ordering rule the types enforce: a candidate that fails a feasibility gate
 * has no composite score at all. A numerically close but physically impossible
 * frame must never outrank a slightly-off but buildable one, and the cleanest
 * way to guarantee that is to make the two states different shapes.
 */

import type { Degrees, Millimeters, Score, Sigma } from './units.js';
import type { CandidateSetup } from './fit.js';

// --- Feasibility -----------------------------------------------------------

/** Hard gates. Each maps to one rider-readable sentence. */
export type GateId =
  | 'reachFloor'
  | 'reachCeiling'
  | 'dropFloor'
  | 'dropCeiling'
  | 'saddleSetback'
  | 'seatpostExtension'
  | 'seatpostMinInsertion'
  | 'standover'
  | 'integratedCockpitUnavailable';

export interface GateFailure {
  readonly gate: GateId;
  readonly message: string;
  /** How far past the limit, in the limit's own unit. Drives "how close was it". */
  readonly exceededBy: Millimeters;
  /** True when no component change can fix it - the frame itself is wrong. */
  readonly structural: boolean;
}

// --- Verdict and flags -----------------------------------------------------

/**
 * The single overall answer. Thresholds live in `SCORE_THRESHOLDS`.
 *
 * Deliberately separate from `FitFlag`: the verdict says *how well*, the flags
 * say *what is wrong*. "borderline, too aggressive, requires too many spacers"
 * is three facts, and collapsing them into one enum discards two of them.
 */
export type FitVerdict =
  | 'excellentFit'
  | 'worksWithModerateAdjustment'
  | 'borderline'
  | 'notRecommended';

export const SCORE_THRESHOLDS = {
  excellentFit: 85,
  worksWithModerateAdjustment: 68,
  borderline: 50,
} as const;

/**
 * Diagnostics, evaluated on the UNCLAMPED solve - the question is what the
 * frame demands, not what survived being clamped to buildable parts.
 */
export type FitFlag =
  /** Frame is built lower than the rider wants to ride. */
  | 'tooAggressive'
  /** Front end too tall; the rider cannot get low enough. */
  | 'tooRelaxed'
  /** Required spacer stack exceeds the frame limit. Structural, not preference. */
  | 'requiresTooManySpacers'
  /** Required stem below 70 mm or above 130 mm. */
  | 'requiresExtremeStem'
  /** Solution sits at zero spacers - fits now, cannot go lower later. */
  | 'noRoomToLower'
  /** Solution sits at the longest catalogue stem. */
  | 'noRoomToLengthen'
  /** Stem must be flipped positive to reach the target. */
  | 'flippedStemRequired'
  /** Handlebar model unknown; defaults used, +-10 mm extra uncertainty. */
  | 'assumedBarGeometry'
  /** Only an effective seat tube angle was available. */
  | 'effectiveSeatAngleAssumed';

// --- Penalties -------------------------------------------------------------

/**
 * Every candidate starts at 100 and loses points. The breakdown is retained in
 * full because the explanation is generated from it - a score without its terms
 * cannot be defended to the rider.
 */
export interface PenaltyBreakdown {
  /** Frame physically cannot reach the target. Only non-zero when clamped. */
  readonly unreachableReach: number;
  readonly unreachableStack: number;
  /** Continuous pull towards a neutral cockpit. Always active. */
  readonly stemCentre: number;
  readonly spacerCentre: number;
  /** Escalating, once outside what a shop stocks comfortably. */
  readonly stemBand: number;
  readonly spacerBand: number;
  /** Flat configuration penalties. */
  readonly flippedStem: number;
  readonly extremeAngle: number;
  readonly railNearLimit: number;
  readonly nonStockSeatpost: number;
  readonly integratedCockpit: number;
  /** Flat safety and handling penalties. */
  readonly toeOverlap: number;
  readonly lowStandover: number;
  readonly trailDeviation: number;
}

/** Weights, in points per millimetre unless the term is flat. */
export const PENALTY_WEIGHTS = {
  unreachableReachPerMm: 3.0,
  unreachableStackPerMm: 2.0,
  unreachableDeadbandMm: 3,

  stemCentrePerMm: 0.35,
  stemNeutralMm: 100,
  spacerCentrePerMm: 0.3,
  spacerNeutralMm: 15,

  stemBandPerMm: 1.0,
  stemBandMinMm: 85,
  stemBandMaxMm: 115,
  spacerBandPerMm: 1.0,
  spacerBandMinMm: 5,
  spacerBandMaxMm: 30,

  flippedStem: 5,
  extremeAngle: 3,
  railNearLimit: 4,
  nonStockSeatpost: 3,
  integratedCockpit: 6,

  toeOverlap: 12,
  lowStandover: 15,
  trailDeviation: 8,
} as const;

/** The cockpit the engine says to build. */
export interface RequiredCockpit {
  readonly stemLength: Millimeters;
  readonly stemAngle: Degrees;
  readonly stemFlipped: boolean;
  readonly spacerHeight: Millimeters;
  /** Before clamping - what the frame actually demanded. Drives the flags. */
  readonly unclampedStemLength: Millimeters;
  readonly unclampedSpacerHeight: Millimeters;
}

// --- Explanation -----------------------------------------------------------

/**
 * One term of the delta attribution. Produced by one-at-a-time substitution:
 * hold the reference bike constant, swap in a single candidate property, and
 * record how far the contact points moved.
 *
 * This is what turns a score into an argument, and it is the reason the product
 * can answer "why" rather than only "which".
 */
export interface AttributionTerm {
  readonly property:
    | 'reach'
    | 'stack'
    | 'headTubeAngle'
    | 'seatTubeAngle'
    | 'headTubeLength'
    | 'stemLength'
    | 'stemAngle'
    | 'spacerStack'
    | 'handlebarReach'
    | 'handlebarRise'
    | 'seatpostSetback'
    | 'saddleOffset';
  /** Contribution to the horizontal delta. Signed. */
  readonly deltaX: Millimeters;
  /** Contribution to the vertical delta. Signed. */
  readonly deltaY: Millimeters;
  /** Rider-readable cause, e.g. "the seat angle is 0.5 degrees slacker". */
  readonly description: string;
}

export interface DeltaAttribution {
  readonly totalDeltaX: Millimeters;
  readonly totalDeltaY: Millimeters;
  /** Sorted by magnitude, largest first. */
  readonly terms: ReadonlyArray<AttributionTerm>;
  /** Interaction effects the one-at-a-time decomposition cannot assign. */
  readonly residual: { readonly x: Millimeters; readonly y: Millimeters };
}

/** The narrative shown in the Geometry Explain tab. */
export interface FitExplanation {
  readonly candidateId: string;
  /** One sentence. The answer, before any evidence. */
  readonly verdict: string;
  /** The single property contributing most of the delta. */
  readonly dominantCause: AttributionTerm;
  readonly attribution: DeltaAttribution;
  /** At most three sentences of generated prose. */
  readonly narrative: string;
  /** Named so the rider can act, or an empty list when nothing can be done. */
  readonly remedies: ReadonlyArray<string>;
}

/** One row of the Fit Ranking tab. */
export interface RankedCandidate {
  readonly rank: number;
  readonly result: FitResult;
  readonly explanation?: FitExplanation;
  /** Set when two sizes are both feasible and the choice is a genuine trade-off. */
  readonly tradeoffNote?: string;
}

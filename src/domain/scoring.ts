/**
 * Scoring and explanation.
 *
 * The ordering rule the types enforce: a candidate that fails a feasibility gate
 * has no composite score at all. A numerically close but physically impossible
 * frame must never outrank a slightly-off but buildable one, and the cleanest
 * way to guarantee that is to make the two states different shapes.
 */

import type { Millimeters, Score, Sigma } from './units.js';
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

// --- Sub-scores ------------------------------------------------------------

export interface SubScores {
  /** Closeness of the achieved position to target. Weight 0.40. */
  readonly position: Score;
  /** Remaining adjustment range around the solution. Weight 0.25. */
  readonly headroom: Score;
  /** Standover, toe overlap, handling deltas. Weight 0.20. */
  readonly constraints: Score;
  /** How ordinary the required parts are. Weight 0.15. */
  readonly components: Score;
}

export const SUB_SCORE_WEIGHTS = {
  position: 0.4,
  headroom: 0.25,
  constraints: 0.2,
  components: 0.15,
} as const satisfies Record<keyof SubScores, number>;

/** Tolerance bands, in rider language. */
export type FitBand =
  /** Within 5 mm reach / 8 mm drop. Indistinguishable. */
  | 'A'
  /** Within 12 / 18. Adapts within a ride. */
  | 'B'
  /** Within 25 / 35. Noticeably different. */
  | 'C'
  /** Beyond that. A different bike. */
  | 'D';

/**
 * The result for one candidate. A discriminated union: `infeasible` carries no
 * score, so no call site can accidentally rank it.
 */
export type FitResult =
  | {
      readonly kind: 'feasible';
      readonly candidate: CandidateSetup;
      readonly composite: Score;
      /** Half-width of the confidence interval, propagated from input provenance. */
      readonly confidence: Sigma;
      readonly subScores: SubScores;
      readonly band: FitBand;
      readonly deviation: { readonly reach: Millimeters; readonly drop: Millimeters };
      readonly warnings: ReadonlyArray<FitWarning>;
    }
  | {
      readonly kind: 'infeasible';
      readonly candidate: CandidateSetup;
      readonly failures: ReadonlyArray<GateFailure>;
    };

/** Non-blocking concerns. Shown, never silently folded into the score. */
export interface FitWarning {
  readonly code:
    | 'toeOverlap'
    | 'lowStandover'
    | 'trailDeviation'
    | 'stemAtLimit'
    | 'spacersAtLimit'
    | 'railAtLimit'
    | 'lowConfidenceInput'
    | 'effectiveSeatAngleAssumed';
  readonly message: string;
  readonly severity: 'info' | 'caution';
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

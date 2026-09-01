/**
 * Scoring: from a frame and a target to a score, a verdict and diagnostic flags.
 *
 * The weighting is headroom-dominant, not deviation-dominant. Three cockpit
 * degrees of freedom against a two-dimensional target means nearly every frame
 * reaches the target exactly, so deviation discriminates almost nothing and the
 * real signal is how extreme the required cockpit is.
 * See docs/scoring-engine.md section 3.
 */

import type { BbPoint, Millimeters, Score } from '../domain/units';
import { mm, score as toScore } from '../domain/units';
import type { FitFlag, FitVerdict, PenaltyBreakdown } from '../domain/scoring';
import { PENALTY_WEIGHTS as W, SCORE_THRESHOLDS as T } from '../domain/scoring';
import type { FrameCore, ResolvedCockpit } from './forward';
import { gripPoint } from './forward';
import type { CockpitSolution } from './solve';
import { solveAll } from './solve';
import type { CockpitLimits } from './assumptions';
import { DEFAULT_LIMITS, clamp, snapStem } from './assumptions';

/**
 * What counts as an "ordinary" cockpit.
 *
 * The defaults are the handling-neutral centre of the range. But when a client
 * already rides a fitted bike, THEIR cockpit is the neutral one: penalising a
 * frame for needing the 80 mm stem the client happily rides would rank their own
 * bike below its neighbours, which is plainly wrong and destroys trust in the
 * whole list.
 */
export interface CockpitNeutral {
  readonly stemLength: number;
  readonly spacerHeight: number;
}

export interface FrameEvaluation {
  readonly frame: FrameCore;
  /** What the frame demanded, before clamping. Flags are diagnosed on this. */
  readonly required: CockpitSolution;
  /** What can actually be built. */
  readonly built: ResolvedCockpit;
  readonly achieved: BbPoint;
  readonly deviation: { readonly reach: Millimeters; readonly stack: Millimeters };
  readonly penalties: PenaltyBreakdown;
  readonly composite: Score;
  readonly verdict: FitVerdict;
  readonly flags: ReadonlyArray<FitFlag>;
}

const outside = (v: number, lo: number, hi: number): number =>
  Math.max(0, lo - v) + Math.max(0, v - hi);

const emptyPenalties = (): PenaltyBreakdown => ({
  unreachableReach: 0, unreachableStack: 0,
  stemCentre: 0, spacerCentre: 0, stemBand: 0, spacerBand: 0,
  flippedStem: 0, extremeAngle: 0, railNearLimit: 0,
  nonStockSeatpost: 0, integratedCockpit: 0,
  toeOverlap: 0, lowStandover: 0, trailDeviation: 0,
});

/** Evaluate one candidate solution: clamp it, measure it, penalise it. */
function evaluateSolution(
  frame: FrameCore,
  target: BbPoint,
  base: ResolvedCockpit,
  sol: CockpitSolution,
  limits: CockpitLimits,
  frameSpacerMax?: Millimeters,
  neutral?: CockpitNeutral,
): FrameEvaluation {
  const spacerMax = frameSpacerMax ?? limits.spacerMax;
  const stemNeutral = neutral?.stemLength ?? W.stemNeutralMm;
  const spacerNeutral = neutral?.spacerHeight ?? W.spacerNeutralMm;

  const spacerHeight = mm(clamp(sol.spacerHeight, limits.spacerMin, spacerMax));
  const stemLength = snapStem(
    clamp(sol.stemLength, limits.stemMin, limits.stemMax),
    limits.stemLengths,
  );

  const built: ResolvedCockpit = { ...base, spacerHeight, stemLength, stemAngle: sol.stemAngle };
  const achieved = gripPoint(frame, built);

  const dReach = achieved.x - target.x;
  const dStack = achieved.y - target.y;

  const p: PenaltyBreakdown = {
    ...emptyPenalties(),
    unreachableReach:
      W.unreachableReachPerMm * Math.max(0, Math.abs(dReach) - W.unreachableDeadbandMm),
    unreachableStack:
      W.unreachableStackPerMm * Math.max(0, Math.abs(dStack) - W.unreachableDeadbandMm),
    stemCentre: W.stemCentrePerMm * Math.abs(stemLength - stemNeutral),
    spacerCentre: W.spacerCentrePerMm * Math.abs(spacerHeight - spacerNeutral),
    stemBand: W.stemBandPerMm * outside(stemLength, W.stemBandMinMm, W.stemBandMaxMm),
    spacerBand: W.spacerBandPerMm * outside(spacerHeight, W.spacerBandMinMm, W.spacerBandMaxMm),
    flippedStem: sol.stemAngle > 0 ? W.flippedStem : 0,
    extremeAngle: Math.abs(sol.stemAngle) === 17 ? W.extremeAngle : 0,
  };

  const total = Object.values(p).reduce((a, b) => a + b, 0);
  const composite = toScore(100 - total);

  return {
    frame,
    required: sol,
    built,
    achieved,
    deviation: { reach: mm(dReach), stack: mm(dStack) },
    penalties: p,
    composite,
    verdict: verdictFor(composite),
    flags: flagsFor(sol, spacerHeight, stemLength, dStack, spacerMax, limits),
  };
}

export function verdictFor(s: number): FitVerdict {
  if (s >= T.excellentFit) return 'excellentFit';
  if (s >= T.worksWithModerateAdjustment) return 'worksWithModerateAdjustment';
  if (s >= T.borderline) return 'borderline';
  return 'notRecommended';
}

/**
 * Flags are diagnosed on the UNCLAMPED solution: the question is what the frame
 * demands, not what survived being clamped to buildable parts.
 */
export function flagsFor(
  required: CockpitSolution,
  builtSpacers: number,
  builtStem: number,
  dStack: number,
  spacerMax: number,
  limits: CockpitLimits,
): ReadonlyArray<FitFlag> {
  const f: FitFlag[] = [];
  if (required.spacerHeight > spacerMax) f.push('requiresTooManySpacers');
  if (required.stemLength > limits.stemMax || required.stemLength < limits.stemMin) {
    f.push('requiresExtremeStem');
  }
  if (required.spacerHeight > spacerMax || dStack < -20) f.push('tooAggressive');
  if (required.spacerHeight < -8 || dStack > 20) f.push('tooRelaxed');
  if (builtSpacers <= 0) f.push('noRoomToLower');
  if (builtStem >= limits.stemMax) f.push('noRoomToLengthen');
  if (required.stemAngle > 0) f.push('flippedStemRequired');
  return f;
}

/**
 * Evaluate a frame against a target: solve every catalogue angle, keep the best.
 */
export function evaluateFrame(
  frame: FrameCore,
  target: BbPoint,
  base: ResolvedCockpit,
  limits: CockpitLimits = DEFAULT_LIMITS,
  frameSpacerMax?: Millimeters,
  neutral?: CockpitNeutral,
): FrameEvaluation {
  const evaluations = solveAll(frame, target, base).map((sol) =>
    evaluateSolution(frame, target, base, sol, limits, frameSpacerMax, neutral),
  );
  // solveAll never returns empty for catalogue angles; the guard keeps the
  // return type honest rather than asserting.
  const first = evaluations[0];
  if (first === undefined) throw new Error('no cockpit solution produced');
  return evaluations.reduce((best, e) => (e.composite > best.composite ? e : best), first);
}

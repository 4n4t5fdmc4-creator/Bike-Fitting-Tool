/**
 * Model-level recommendation.
 *
 * The question a fitter actually answers is not "score every frame" but
 * "which SIZE of this model, and what would it take". So results are grouped by
 * model, the best size in each is chosen, and the runner-up is kept because
 * between-sizes is the common case and hiding the alternative is what makes a
 * size chart untrustworthy.
 */

import type { BbPoint, Degrees, Millimeters } from '../domain/units';
import type { ResolvedCockpit } from './forward';
import { evaluateFrame, type CockpitNeutral, type FrameEvaluation } from './score';

export interface CandidateFrame {
  readonly id: string;
  readonly model: string;
  readonly size: string;
  readonly stack: Millimeters;
  readonly reach: Millimeters;
  readonly headTubeAngle: Degrees;
  readonly maxSpacerStack: Millimeters;
  /**
   * Secondary geometry, not used by scoring - carried through only so the
   * overlay can draw real tubes instead of typical fallbacks. All optional:
   * a manufacturer table publishes a different subset for every brand.
   */
  readonly seatTubeAngle?: Degrees;
  readonly headTubeLength?: Millimeters;
  readonly chainstay?: Millimeters;
  readonly effectiveTopTube?: Millimeters;
  readonly wheelbase?: Millimeters;
  readonly bbDrop?: Millimeters;
  readonly tyreMax?: Millimeters;
  readonly trail?: Millimeters;
  readonly cockpitType?: 'open' | 'semi-integrated' | 'integrated';
  readonly sourceUrl?: string;
  readonly stockStem?: Millimeters;
  readonly stockStemAngle?: Degrees;
  readonly stockSpacers?: Millimeters;
}

export interface ModelRecommendation {
  readonly model: string;
  readonly best: { frame: CandidateFrame; evaluation: FrameEvaluation };
  /** Kept whenever a second size is genuinely competitive. */
  readonly alternative?: { frame: CandidateFrame; evaluation: FrameEvaluation };
  /** True when the two are close enough that calling a winner would be false precision. */
  readonly closeCall: boolean;
  readonly allSizes: ReadonlyArray<{ frame: CandidateFrame; evaluation: FrameEvaluation }>;
}

/** Within this many points, two sizes are a trade-off rather than a ranking. */
export const CLOSE_CALL_POINTS = 6;

export function recommendByModel(
  frames: ReadonlyArray<CandidateFrame>,
  target: BbPoint,
  base: ResolvedCockpit,
  /** The client's own cockpit, when they ride a fitted bike. See CockpitNeutral. */
  neutral?: CockpitNeutral,
): ReadonlyArray<ModelRecommendation> {
  const byModel = new Map<string, CandidateFrame[]>();
  for (const f of frames) {
    const list = byModel.get(f.model);
    if (list) list.push(f);
    else byModel.set(f.model, [f]);
  }

  const out: ModelRecommendation[] = [];
  for (const [model, list] of byModel) {
    const scored = list
      .map((frame) => ({
        frame,
        evaluation: evaluateFrame(frame, target, base, undefined, frame.maxSpacerStack, neutral),
      }))
      .sort((a, b) => b.evaluation.composite - a.evaluation.composite);

    const best = scored[0];
    if (!best) continue;
    const second = scored[1];
    const closeCall =
      second !== undefined && best.evaluation.composite - second.evaluation.composite <= CLOSE_CALL_POINTS;

    out.push({
      model,
      best,
      ...(second ? { alternative: second } : {}),
      closeCall,
      allSizes: scored,
    });
  }

  return out.sort((a, b) => b.best.evaluation.composite - a.best.evaluation.composite);
}

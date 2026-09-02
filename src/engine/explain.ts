/**
 * Explanation assembly.
 *
 * Nothing is authored per case. Four verdicts times nine flags times a dozen
 * causes is over a thousand situations, so every explanation is composed from
 * four clauses with the engine's own numbers filled in.
 * See docs/explanation-system.md.
 */

import type { FitFlag } from '../domain/scoring';
import type { FrameEvaluation } from './score';
import { DEFAULT_LIMITS } from './assumptions';
import { compare } from './phrases';

export interface Explanation {
  /** What to do. Always present, always one sentence. */
  readonly verdict: string;
  /** Why the geometry does that. Present below excellentFit. */
  readonly mechanism?: string;
  /** Which parts change. */
  readonly requirement?: string;
  /** What it costs. At most one, the largest. */
  readonly consequence?: string;
}

const round = (n: number): number => Math.round(n);

/** "101 mm, -6 degrees, 19 mm of spacers" */
export function cockpitSummary(e: FrameEvaluation): string {
  const a = e.built.stemAngle;
  return `${round(e.built.stemLength)} mm ${a > 0 ? '+' : ''}${round(a)}° stem and ${round(
    e.built.spacerHeight,
  )} mm of spacers`;
}

/** Ordered by severity: structural first, comfort last. */
const FLAG_PRIORITY: ReadonlyArray<FitFlag> = [
  'requiresTooManySpacers',
  'requiresExtremeStem',
  'tooAggressive',
  'tooRelaxed',
  'noRoomToLower',
  'noRoomToLengthen',
  'flippedStemRequired',
];

export function primaryFlag(flags: ReadonlyArray<FitFlag>): FitFlag | undefined {
  return FLAG_PRIORITY.find((f) => flags.includes(f));
}

function flagSentence(flag: FitFlag, e: FrameEvaluation, spacerMax: number): string {
  const req = e.required;
  switch (flag) {
    case 'requiresTooManySpacers':
      return `Reaching your bar height needs ${round(req.spacerHeight)} mm of spacers, past this frame's ${round(spacerMax)} mm limit. That is a limit on the steerer, not a matter of taste.`;
    case 'requiresExtremeStem':
      return req.stemLength > DEFAULT_LIMITS.stemMax
        ? `Your reach needs a ${round(req.stemLength)} mm stem. Past about 130 mm the steering goes heavy and more of your weight lands on your hands.`
        : `Your reach needs a ${round(req.stemLength)} mm stem. Below about 70 mm the steering turns nervous and the front wheel carries less weight.`;
    case 'tooAggressive':
      return `Even at the spacer limit your hands sit ${round(Math.abs(e.deviation.stack))} mm below your target. This frame is built to be ridden lower than you want to ride it.`;
    case 'tooRelaxed':
      return `With no spacers at all your hands still sit ${round(Math.abs(e.deviation.stack))} mm above your target. You cannot get low enough on this frame.`;
    case 'noRoomToLower':
      return 'This works with the stem sitting directly on the headset. It fits, but there is nothing left to remove if you later want to go lower.';
    case 'noRoomToLengthen':
      return 'This uses the longest stem we would recommend. It fits, but there is nowhere left to go if your reach grows.';
    case 'flippedStemRequired':
      return 'This needs the stem flipped to point upwards. It costs nothing, and it raises your bars while shortening your reach at the same time.';
    default:
      return '';
  }
}

export function explain(
  e: FrameEvaluation,
  sizeLabel: string,
  spacerMax: number = DEFAULT_LIMITS.spacerMax,
): Explanation {
  const flag = primaryFlag(e.flags);
  const cockpit = cockpitSummary(e);

  if (e.verdict === 'excellentFit') {
    return {
      verdict: `The ${sizeLabel} fits you.`,
      requirement: `It reaches your position with a ${cockpit} — ordinary parts.`,
      ...(flag ? { consequence: flagSentence(flag, e, spacerMax) } : {}),
    };
  }

  if (e.verdict === 'notRecommended') {
    return {
      verdict: `The ${sizeLabel} does not fit you.`,
      ...(flag ? { mechanism: flagSentence(flag, e, spacerMax) } : {}),
      consequence: 'No stem or spacer combination fixes this.',
    };
  }

  const opening =
    e.verdict === 'borderline'
      ? `The ${sizeLabel} only just works.`
      : `The ${sizeLabel} works, with the right parts.`;

  return {
    verdict: opening,
    ...(flag ? { mechanism: flagSentence(flag, e, spacerMax) } : {}),
    requirement: `It needs a ${cockpit}.`,
  };
}

/**
 * How a candidate's position differs from a reference, in a rider's words.
 * Returns both the short label and the precise phrase - they cannot disagree,
 * because both come from the same two numbers.
 */
export function describeDifference(
  candidateGripReach: number,
  candidateGripStack: number,
  referenceGripReach: number,
  referenceGripStack: number,
): ReturnType<typeof compare> {
  return compare(
    candidateGripReach - referenceGripReach,
    candidateGripStack - referenceGripStack,
  );
}

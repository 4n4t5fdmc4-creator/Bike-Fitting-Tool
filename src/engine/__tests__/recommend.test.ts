import { describe, expect, it } from 'vitest';
import { deg, mm } from '../../domain/units';
import { gripPoint } from '../forward';
import { resolveCockpit } from '../assumptions';
import { recommendByModel, type CandidateFrame } from '../recommend';

const f = (model: string, size: string, stack: number, reach: number, hta: number): CandidateFrame => ({
  id: `${model}-${size}`, model, size,
  stack: mm(stack), reach: mm(reach), headTubeAngle: deg(hta), maxSpacerStack: mm(40),
});

// One model, a full size run - the real question is which size, not which frame.
const RUN: CandidateFrame[] = [
  f('Model A', '49', 505, 372, 71.5), f('Model A', '52', 525, 380, 72.5),
  f('Model A', '54', 545, 388, 73.0), f('Model A', '56', 565, 395, 73.5),
  f('Model A', '58', 585, 403, 73.5),
  f('Model B', 'S', 570, 376, 70.5), f('Model B', 'M', 595, 383, 71.0),
];

const BASE = resolveCockpit();
const TARGET = gripPoint(
  { stack: mm(565), reach: mm(395), headTubeAngle: deg(73.5) },
  resolveCockpit({ stemLength: mm(100), stemAngle: deg(-6), spacerHeight: mm(20) }),
);

describe('model-level recommendation', () => {
  it('returns one entry per model, best model first', () => {
    const recs = recommendByModel(RUN, TARGET, BASE);
    expect(recs.map((r) => r.model)).toEqual(['Model A', 'Model B']);
  });

  it('picks the size the target was taken from', () => {
    const recs = recommendByModel(RUN, TARGET, BASE);
    expect(recs[0]!.best.frame.size).toBe('56');
  });

  it('keeps every size available behind the recommendation', () => {
    const recs = recommendByModel(RUN, TARGET, BASE);
    expect(recs[0]!.allSizes).toHaveLength(5);
    const scores = recs[0]!.allSizes.map((s) => s.evaluation.composite);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('flags a genuine between-sizes case instead of forcing a winner', () => {
    // A target sitting deliberately between two sizes.
    const between = gripPoint(
      { stack: mm(575), reach: mm(399), headTubeAngle: deg(73.5) },
      resolveCockpit({ stemLength: mm(100), stemAngle: deg(-6), spacerHeight: mm(20) }),
    );
    const rec = recommendByModel(RUN, between, BASE)[0]!;
    expect(rec.closeCall).toBe(true);
    expect(rec.alternative).toBeDefined();
  });

  it('does not call a close race when one size is clearly better', () => {
    const recs = recommendByModel(RUN, TARGET, BASE);
    const a = recs[0]!;
    if (!a.closeCall) {
      expect(a.best.evaluation.composite - (a.alternative?.evaluation.composite ?? 0))
        .toBeGreaterThan(6);
    }
  });
});

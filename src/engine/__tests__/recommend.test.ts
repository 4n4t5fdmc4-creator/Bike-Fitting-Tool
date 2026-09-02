import { describe, expect, it } from 'vitest';
import { deg, mm } from '../../domain/units';
import { gripPoint } from '../forward';
import { resolveCockpit } from '../assumptions';
import { recommendByModel, type CandidateFrame } from '../recommend';
import { CATALOGUE_STEM_ANGLES } from '../solve';

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

describe('the client’s own cockpit sets the neutral point', () => {
  // A fitted client rides an 80 mm stem happily. Scoring against a generic
  // 100 mm neutral penalises exactly the bike they already own, which would
  // rank their own frame below its neighbours - visibly wrong, and the fastest
  // way to lose a fitter's trust in the list.
  const OWN: CandidateFrame[] = [
    f('Own', '530', 583.2, 383.7, 70.75),
    f('Own', '550', 598.4, 390.4, 71.75),
    f('Own', '575', 613.6, 398.2, 72.0),
  ];
  const fitted = resolveCockpit({
    stemLength: mm(80), stemAngle: deg(-6), spacerHeight: mm(10),
    barReach: mm(76), barRise: mm(5),
  });
  const ownTarget = gripPoint(
    { stack: mm(598.4), reach: mm(390.4), headTubeAngle: deg(71.75) },
    fitted,
  );

  it('ranks the frame the client actually rides first', () => {
    const rec = recommendByModel(OWN, ownTarget, BASE, { stemLength: 80, spacerHeight: 10 })[0]!;
    expect(rec.best.frame.size).toBe('550');
  });

  it('and would not, using the generic neutral', () => {
    // Documents the behaviour the override exists to fix.
    const rec = recommendByModel(OWN, ownTarget, BASE)[0]!;
    expect(rec.best.frame.size).not.toBe('550');
  });
});

describe('the handlebar travels with the fit', () => {
  /**
   * Regression. The target was measured with the client's own bar while
   * candidates were evaluated against a generic one, so his own frame failed to
   * reproduce his own build: 78 mm of stem and 16 mm of spacers instead of the
   * 80 and 10 he actually rides - and a different stem angle won on the strength
   * of that error.
   */
  const OWN = f('Grevil F', '550', 598.4, 390.4, 71.75);
  const hisBar = { barReach: mm(76), barRise: mm(5) };
  const hisCockpit = resolveCockpit({
    ...hisBar, stemLength: mm(80), stemAngle: deg(-6), spacerHeight: mm(10),
  });
  const target = gripPoint(
    { stack: mm(598.4), reach: mm(390.4), headTubeAngle: deg(71.75) },
    hisCockpit,
  );

  it('reproduces the exact build when evaluated on the same bar', () => {
    const rec = recommendByModel([OWN], target, resolveCockpit(hisBar), {
      stemLength: 80, spacerHeight: 10, stemAngle: -6,
    })[0]!;
    expect(rec.best.evaluation.built.stemLength).toBeCloseTo(80, 0);
    expect(rec.best.evaluation.built.spacerHeight).toBeCloseTo(10, 0);
    expect(rec.best.evaluation.built.stemAngle).toBe(-6);
  });

  it('does not, on a generic bar — which is the bug this guards', () => {
    const rec = recommendByModel([OWN], target, resolveCockpit(), {
      stemLength: 80, spacerHeight: 10, stemAngle: -6,
    })[0]!;
    const exact =
      Math.abs(rec.best.evaluation.built.spacerHeight - 10) < 1 &&
      rec.best.evaluation.built.stemAngle === -6;
    expect(exact).toBe(false);
  });
});

describe('stem angle catalogue', () => {
  it('does not recommend a 0 degree stem', () => {
    // They exist but are rare on drop-bar bikes; suggesting one sends a rider
    // looking for something the shop does not stock.
    expect(CATALOGUE_STEM_ANGLES).not.toContain(0);
  });

  it('offers the angles shops actually carry', () => {
    for (const a of [-17, -6, 6, 17]) expect(CATALOGUE_STEM_ANGLES).toContain(a);
  });
});

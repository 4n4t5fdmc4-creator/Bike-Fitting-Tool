import { describe, expect, it } from 'vitest';
import { deg, mm } from '../../domain/units';
import { gripPoint } from '../forward';
import { resolveCockpit } from '../assumptions';
import { evaluateFrame } from '../score';
import { deriveTarget } from '../target';

describe('derived target', () => {
  const rider = {
    height: mm(1800), inseam: mm(840),
    style: 'allround' as const, flexibility: 'average' as const,
  };

  it('produces a plausible saddle height', () => {
    // 0.883 x inseam. Typical road saddle heights run 620-830 mm.
    expect(deriveTarget(rider).saddleHeight).toBeCloseTo(741.7, 1);
  });

  it('lands close to a well-fitted race 56, which is the calibration anchor', () => {
    // Cross-check: the body-derived target for a 180 cm allround rider should
    // land near the position a Race 56 produces with an ordinary cockpit. If
    // these two drift apart, one of them is wrong.
    const reference = gripPoint(
      { stack: mm(565), reach: mm(395), headTubeAngle: deg(73.5) },
      resolveCockpit({ stemLength: mm(100), stemAngle: deg(-6), spacerHeight: mm(20) }),
    );
    const derived = deriveTarget(rider).grip;
    expect(Math.abs(derived.x - reference.x)).toBeLessThan(15);
    expect(Math.abs(derived.y - reference.y)).toBeLessThan(15);
  });

  it('ranks that same frame highly for that rider', () => {
    const target = deriveTarget(rider).grip;
    const e = evaluateFrame(
      { stack: mm(565), reach: mm(395), headTubeAngle: deg(73.5) },
      target,
      resolveCockpit(),
    );
    expect(e.verdict).toBe('excellentFit');
  });

  it('a performance rider sits longer and lower than a comfort rider', () => {
    const perf = deriveTarget({ ...rider, style: 'performance' });
    const comf = deriveTarget({ ...rider, style: 'comfort' });
    expect(perf.grip.x).toBeGreaterThan(comf.grip.x);
    expect(perf.grip.y).toBeLessThan(comf.grip.y);
  });

  it('limited flexibility raises the bars', () => {
    const stiff = deriveTarget({ ...rider, flexibility: 'limited' });
    const supple = deriveTarget({ ...rider, flexibility: 'good' });
    expect(stiff.grip.y).toBeGreaterThan(supple.grip.y);
    expect(stiff.drop).toBeLessThan(supple.drop);
  });

  it('scales with the rider', () => {
    const small = deriveTarget({ ...rider, height: mm(1650), inseam: mm(760) });
    const tall = deriveTarget({ ...rider, height: mm(1930), inseam: mm(910) });
    expect(small.grip.x).toBeLessThan(tall.grip.x);
    expect(small.grip.y).toBeLessThan(tall.grip.y);
    expect(small.saddleHeight).toBeLessThan(tall.saddleHeight);
  });

  it('never claims more precision than it has', () => {
    expect(deriveTarget(rider).uncertainty).toBeGreaterThanOrEqual(15);
  });
});

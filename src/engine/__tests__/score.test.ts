import { describe, expect, it } from 'vitest';
import { deg, mm } from '../../domain/units';
import type { FrameCore } from '../forward';
import { gripPoint } from '../forward';
import { resolveCockpit } from '../assumptions';
import { evaluateFrame, verdictFor } from '../score';

const frame = (stack: number, reach: number, hta: number): FrameCore => ({
  stack: mm(stack), reach: mm(reach), headTubeAngle: deg(hta),
});

const BASE = resolveCockpit();

/**
 * The target is defined as an ACHIEVABLE position rather than a round number:
 * a Race 56 with a 100 mm -6 degree stem and 20 mm of spacers. That makes the
 * calibration self-validating - the frame the target came from must win.
 */
const REFERENCE = frame(565, 395, 73.5);
const TARGET = gripPoint(
  REFERENCE,
  resolveCockpit({ stemLength: mm(100), stemAngle: deg(-6), spacerHeight: mm(20) }),
);

describe('calibration run', () => {
  it('places the target where a 180 cm allround rider would sit', () => {
    expect(TARGET.x).toBeCloseTo(594.1, 1);
    expect(TARGET.y).toBeCloseTo(651.2, 1);
  });

  // These figures are the contract between the engine and docs/scoring-engine.md
  // section 10. If a weight changes, this test fails on purpose: the documented
  // table must be regenerated and re-read, not quietly left stale.
  const CASES: ReadonlyArray<{
    name: string; f: FrameCore; reqSpacers: number; reqStem: number;
    score: number; verdict: string;
  }> = [
    { name: 'Race 52', f: frame(525, 380, 72.5), reqSpacers: 28, reqStem: 127, score: 65.6, verdict: 'borderline' },
    { name: 'Race 54', f: frame(545, 388, 73.0), reqSpacers: 26, reqStem: 112, score: 93.3, verdict: 'excellentFit' },
    { name: 'Race 56', f: REFERENCE, reqSpacers: 20, reqStem: 100, score: 98.5, verdict: 'excellentFit' },
    { name: 'Race 58', f: frame(585, 403, 73.5), reqSpacers: 11, reqStem: 88, score: 95.3, verdict: 'excellentFit' },
    { name: 'Race 60', f: frame(605, 412, 73.5), reqSpacers: -2, reqStem: 75, score: 71.4, verdict: 'worksWithModerateAdjustment' },
    { name: 'Endurance 54', f: frame(570, 380, 71.5), reqSpacers: 8, reqStem: 114, score: 91.7, verdict: 'excellentFit' },
    { name: 'Endurance 56', f: frame(592, 387, 72.0), reqSpacers: 9, reqStem: 104, score: 91.5, verdict: 'excellentFit' },
    { name: 'Gravel M', f: frame(595, 383, 71.0), reqSpacers: 4, reqStem: 107, score: 89.6, verdict: 'excellentFit' },
    { name: 'Allroad L', f: frame(610, 392, 71.5), reqSpacers: -10, reqStem: 93, score: 59.7, verdict: 'borderline' },
    { name: 'Comfort XL', f: frame(660, 385, 70.5), reqSpacers: -64, reqStem: 83, score: 0.0, verdict: 'notRecommended' },
  ];

  for (const c of CASES) {
    it(`${c.name} reproduces the documented result`, () => {
      const e = evaluateFrame(c.f, TARGET, BASE);
      expect(e.required.spacerHeight).toBeCloseTo(c.reqSpacers, 0);
      expect(e.required.stemLength).toBeCloseTo(c.reqStem, 0);
      expect(e.composite).toBeCloseTo(c.score, 1);
      expect(e.verdict).toBe(c.verdict);
    });
  }

  it('ranks the frame the target came from first', () => {
    const ranked = CASES
      .map((c) => ({ name: c.name, score: evaluateFrame(c.f, TARGET, BASE).composite }))
      .sort((a, b) => b.score - a.score);
    expect(ranked[0]!.name).toBe('Race 56');
  });

  it('falls off on both sides of the ideal size', () => {
    const s = (f: FrameCore) => evaluateFrame(f, TARGET, BASE).composite;
    const mid = s(REFERENCE);
    expect(s(frame(545, 388, 73.0))).toBeLessThan(mid);   // one size down
    expect(s(frame(585, 403, 73.5))).toBeLessThan(mid);   // one size up
    expect(s(frame(525, 380, 72.5))).toBeLessThan(s(frame(545, 388, 73.0)));
    expect(s(frame(605, 412, 73.5))).toBeLessThan(s(frame(585, 403, 73.5)));
  });
});

describe('verdict thresholds', () => {
  it('maps scores onto the documented bands', () => {
    expect(verdictFor(100)).toBe('excellentFit');
    expect(verdictFor(85)).toBe('excellentFit');
    expect(verdictFor(84.9)).toBe('worksWithModerateAdjustment');
    expect(verdictFor(68)).toBe('worksWithModerateAdjustment');
    expect(verdictFor(67.9)).toBe('borderline');
    expect(verdictFor(50)).toBe('borderline');
    expect(verdictFor(49.9)).toBe('notRecommended');
    expect(verdictFor(0)).toBe('notRecommended');
  });
});

describe('flags are diagnosed on the unclamped solve', () => {
  it('flags a frame whose front end is too tall as tooRelaxed', () => {
    const e = evaluateFrame(frame(660, 385, 70.5), TARGET, BASE);
    expect(e.required.spacerHeight).toBeLessThan(-8);
    expect(e.flags).toContain('tooRelaxed');
    expect(e.flags).toContain('noRoomToLower');
  });

  it('flags a frame needing a very long stem', () => {
    const e = evaluateFrame(frame(525, 380, 72.5), TARGET, BASE);
    expect(e.required.stemLength).toBeGreaterThan(120);
    expect(e.flags).toContain('noRoomToLengthen');
  });

  it('raises no flags on the frame that fits', () => {
    expect(evaluateFrame(REFERENCE, TARGET, BASE).flags).toEqual([]);
  });

  it('caps the score at zero rather than going negative', () => {
    const e = evaluateFrame(frame(760, 340, 68), TARGET, BASE);
    expect(e.composite).toBe(0);
    expect(e.verdict).toBe('notRecommended');
  });
});

describe('deviation is a weak signal, by design', () => {
  // Three cockpit degrees of freedom against a two-dimensional target means
  // almost every frame reaches the target exactly. This is why the score is
  // headroom-dominant rather than deviation-dominant.
  it('reaches the target within a few mm on most frames', () => {
    const frames = [
      frame(545, 388, 73), frame(565, 395, 73.5), frame(585, 403, 73.5),
      frame(570, 380, 71.5), frame(592, 387, 72), frame(595, 383, 71),
    ];
    for (const f of frames) {
      const e = evaluateFrame(f, TARGET, BASE);
      expect(Math.abs(e.deviation.reach)).toBeLessThan(5);
      expect(Math.abs(e.deviation.stack)).toBeLessThan(5);
    }
  });
});

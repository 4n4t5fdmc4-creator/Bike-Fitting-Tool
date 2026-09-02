import { describe, expect, it } from 'vitest';
import { deg, mm } from '../../domain/units';
import type { FrameCore } from '../forward';
import { gripPoint } from '../forward';
import { resolveCockpit } from '../assumptions';
import {
  ACCUFIT_TOLERANCE_MM,
  DEFAULT_CATALOGUE,
  accufitOptions,
  bestAccufit,
  describeMiss,
} from '../accufit';

const frame = (stack: number, reach: number, hta: number): FrameCore => ({
  stack: mm(stack), reach: mm(reach), headTubeAngle: deg(hta),
});

const f = frame(565, 395, 73);
const base = resolveCockpit();

describe('the enumeration only contains buildable cockpits', () => {
  it('covers every catalogue combination', () => {
    const spacerSteps = DEFAULT_CATALOGUE.maxSpacer / DEFAULT_CATALOGUE.spacerStep + 1;
    expect(accufitOptions(f, base, { x: mm(500), y: mm(700) })).toHaveLength(
      DEFAULT_CATALOGUE.stemLengths.length * DEFAULT_CATALOGUE.stemAngles.length * spacerSteps,
    );
  });

  it('never offers more spacers than the frame allows', () => {
    const rows = accufitOptions(f, base, { x: mm(500), y: mm(700) }, { maxSpacer: 15 });
    expect(Math.max(...rows.map((r) => r.spacerHeight))).toBe(15);
    // Every value it does offer is orderable: whole catalogue steps only.
    for (const r of rows) expect(r.spacerHeight % DEFAULT_CATALOGUE.spacerStep).toBe(0);
  });
});

describe('ranking', () => {
  it('finds the exact build when the target was produced by one', () => {
    // Round-trip: take a build straight out of the catalogue, compute the hood
    // position it produces, and ask for it back. Anything but a hit means the
    // enumeration and the forward model disagree.
    const built = resolveCockpit({ stemLength: mm(110), stemAngle: deg(-6), spacerHeight: mm(15) });
    const target = gripPoint(f, built);

    const best = bestAccufit(f, base, target);
    expect(best).not.toBeNull();
    expect(best!.stemLength).toBe(110);
    expect(best!.stemAngle).toBe(-6);
    expect(best!.spacerHeight).toBe(15);
    expect(best!.miss).toBeCloseTo(0, 6);
    expect(describeMiss(best!)).toBe('on target');
  });

  it('is sorted by miss, best first', () => {
    const rows = accufitOptions(f, base, { x: mm(500), y: mm(700) });
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i]!.miss).toBeGreaterThanOrEqual(rows[i - 1]!.miss - 1e-9);
    }
  });

  it('breaks a tie towards the plainer build', () => {
    // Two rows landing in the same place should present the one that looks like
    // a stock bike: fewer spacers first, then the shorter stem.
    const rows = accufitOptions(f, base, { x: mm(500), y: mm(700) });
    const tied = rows.filter((r) => Math.abs(r.miss - rows[0]!.miss) < 1e-9);
    if (tied.length > 1) {
      expect(tied[0]!.spacerHeight).toBeLessThanOrEqual(tied[1]!.spacerHeight);
    }
  });
});

describe('the Accufit point is the bar clamp, not the hood', () => {
  it('reports a clamp behind and below the hood on a normal bar', () => {
    const best = bestAccufit(f, base, { x: mm(520), y: mm(720) })!;
    expect(best.clamp.x).toBeLessThan(best.hood.x);
    expect(best.clamp.y).toBeLessThan(best.hood.y);
  });

  it('ranks on the hood, so a longer-reach bar changes the winning stem', () => {
    const target = { x: mm(520), y: mm(720) };
    const shortBar = bestAccufit(f, resolveCockpit({ barReach: mm(70) }), target)!;
    const longBar = bestAccufit(f, resolveCockpit({ barReach: mm(90) }), target)!;
    expect(longBar.stemLength).toBeLessThanOrEqual(shortBar.stemLength);
  });
});

describe('describeMiss', () => {
  it('names the direction a build is off in', () => {
    const rows = accufitOptions(f, base, { x: mm(400), y: mm(600) });
    const long = rows.find((r) => r.delta.x > 5 && Math.abs(r.delta.y) < 1);
    if (long) expect(describeMiss(long)).toContain('long');
    expect(ACCUFIT_TOLERANCE_MM).toBe(2);
  });
});

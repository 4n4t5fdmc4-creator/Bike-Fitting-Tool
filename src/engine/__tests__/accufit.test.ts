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
  plainness,
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
  it('reproduces a build exactly when the target was produced by one', () => {
    // Round-trip: take a build straight out of the catalogue, compute the hood
    // position it produces, and find it again in the enumeration. Anything but
    // a zero miss means the enumeration and the forward model disagree.
    const built = resolveCockpit({ stemLength: mm(110), stemAngle: deg(-6), spacerHeight: mm(15) });
    const target = gripPoint(f, built);

    const rows = accufitOptions(f, base, target);
    const exact = rows.find(
      (r) => r.stemLength === 110 && r.stemAngle === -6 && r.spacerHeight === 15,
    );
    expect(exact).toBeDefined();
    expect(exact!.miss).toBeCloseTo(0, 6);
    expect(describeMiss(exact!)).toBe('on target');
    // It is on target, so whatever leads the list is on target too - even if a
    // plainer build that also hits is listed above it.
    expect(bestAccufit(f, base, target)!.miss).toBeLessThanOrEqual(ACCUFIT_TOLERANCE_MM);
  });

  it('puts every on-target row ahead of every row that misses', () => {
    const rows = accufitOptions(f, base, { x: mm(500), y: mm(700) });
    let seenMiss = false;
    for (const r of rows) {
      if (r.miss > ACCUFIT_TOLERANCE_MM) seenMiss = true;
      else expect(seenMiss).toBe(false);
    }
  });

  it('orders the on-target rows by how stock the build is, not by millimetres', () => {
    // Aim at a position several builds can hit, then check the leading group is
    // ordered by plainness. A 0.4 mm win does not justify a +17 stem.
    const built = resolveCockpit({ stemLength: mm(100), stemAngle: deg(-6), spacerHeight: mm(20) });
    const rows = accufitOptions(f, base, gripPoint(f, built));
    const group = rows.filter((r) => r.miss <= ACCUFIT_TOLERANCE_MM);
    expect(group.length).toBeGreaterThan(1);
    for (let i = 1; i < group.length; i += 1) {
      expect(plainness(group[i]!)).toBeGreaterThanOrEqual(plainness(group[i - 1]!) - 1e-9);
    }
    // And the stock-looking build is what comes out on top. Either sign: a stem
    // is symmetric, so +6 and -6 are the same part the other way up.
    expect(Math.abs(group[0]!.stemAngle)).toBe(6);
  });

  it('ranks purely by miss once past the tolerance', () => {
    const rows = accufitOptions(f, base, { x: mm(500), y: mm(700) })
      .filter((r) => r.miss > ACCUFIT_TOLERANCE_MM);
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i]!.miss).toBeGreaterThanOrEqual(rows[i - 1]!.miss - 1e-9);
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

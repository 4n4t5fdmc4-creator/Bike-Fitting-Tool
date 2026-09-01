import { describe, expect, it } from 'vitest';
import { deg, mm } from '../../domain/units.js';
import type { FrameCore } from '../forward.js';
import { barClampPoint, gripPoint, stemAngleAboveHorizontal } from '../forward.js';
import { resolveCockpit } from '../assumptions.js';

const frame = (stack: number, reach: number, hta: number): FrameCore => ({
  stack: mm(stack), reach: mm(reach), headTubeAngle: deg(hta),
});

describe('stem angle convention', () => {
  // Manufacturers label stem angle against the perpendicular of the steering
  // axis. These two identities are how a rider can check the model is right.
  it('a -17 degree stem sits exactly horizontal on a 73 degree head angle', () => {
    const f = frame(565, 395, 73);
    expect(stemAngleAboveHorizontal(f, resolveCockpit({ stemAngle: deg(-17) }))).toBeCloseTo(0, 10);
  });

  it('a -6 degree stem still rises 11 degrees on the same frame', () => {
    const f = frame(565, 395, 73);
    expect(stemAngleAboveHorizontal(f, resolveCockpit({ stemAngle: deg(-6) }))).toBeCloseTo(11, 10);
  });
});

describe('cockpit sensitivity', () => {
  // The documented sensitivity table, docs/product-spec.md section 2.7.
  // Every one of these moves the bar in TWO axes at once.
  const f = frame(565, 395, 73);
  const base = resolveCockpit({ spacerHeight: mm(20), stemLength: mm(100), stemAngle: deg(-6) });
  const b0 = barClampPoint(f, base);

  it('+10 mm of spacers raises the bar 9.6 mm AND shortens reach 2.9 mm', () => {
    const b = barClampPoint(f, resolveCockpit({ ...base, spacerHeight: mm(30) }));
    expect(b.x - b0.x).toBeCloseTo(-2.9, 1);
    expect(b.y - b0.y).toBeCloseTo(9.6, 1);
  });

  it('+10 mm of stem length adds 9.8 mm reach and 1.9 mm height', () => {
    const b = barClampPoint(f, resolveCockpit({ ...base, stemLength: mm(110) }));
    expect(b.x - b0.x).toBeCloseTo(9.8, 1);
    expect(b.y - b0.y).toBeCloseTo(1.9, 1);
  });

  it('swapping -6 for -17 drops the bar 19.1 mm at nearly constant reach', () => {
    const b = barClampPoint(f, resolveCockpit({ ...base, stemAngle: deg(-17) }));
    expect(b.x - b0.x).toBeCloseTo(1.8, 1);
    expect(b.y - b0.y).toBeCloseTo(-19.1, 1);
  });

  it('flipping the stem up raises 20 mm and shortens 6.1 mm together', () => {
    const b = barClampPoint(f, resolveCockpit({ ...base, stemAngle: deg(6) }));
    expect(b.x - b0.x).toBeCloseTo(-6.1, 1);
    expect(b.y - b0.y).toBeCloseTo(20.0, 1);
  });
});

describe('frame geometry moves in exactly one axis each', () => {
  // This is precisely why stack and reach remain the right frame-shopping
  // metric, and why they stop being sufficient once components are involved.
  const c = resolveCockpit();
  const b0 = gripPoint(frame(565, 395, 73), c);

  it('frame reach +10 is pure reach', () => {
    const b = gripPoint(frame(565, 405, 73), c);
    expect(b.x - b0.x).toBeCloseTo(10, 6);
    expect(b.y - b0.y).toBeCloseTo(0, 6);
  });

  it('frame stack +10 is pure height', () => {
    const b = gripPoint(frame(575, 395, 73), c);
    expect(b.x - b0.x).toBeCloseTo(0, 6);
    expect(b.y - b0.y).toBeCloseTo(10, 6);
  });
});

describe('hood offset', () => {
  it('places the grip forward of and above the bar clamp', () => {
    const f = frame(565, 395, 73);
    const c = resolveCockpit();
    const bar = barClampPoint(f, c);
    const grip = gripPoint(f, c);
    expect(grip.x - bar.x).toBeCloseTo(c.barReach + c.hoodForward, 6);
    expect(grip.y - bar.y).toBeCloseTo(c.hoodRise + c.barRise, 6);
  });
});

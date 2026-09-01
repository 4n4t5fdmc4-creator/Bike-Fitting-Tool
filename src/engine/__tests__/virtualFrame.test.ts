import { describe, expect, it } from 'vitest';
import { deg, mm } from '../../domain/units';
import type { BbPoint } from '../../domain/units';
import { gripPoint } from '../forward';
import { resolveCockpit } from '../assumptions';
import { virtualFrameStackReach } from '../virtualFrame';

describe('virtual frame anchor', () => {
  it('round-trips: a real frame\'s target reproduces stack/reach close to the original', () => {
    // Not exact - the virtual frame assumes a fixed 73 degree head angle and a
    // neutral cockpit, while the real frame may use neither. It should still
    // land in the right neighbourhood for a same-size comparison.
    const frame = { stack: mm(565), reach: mm(395), headTubeAngle: deg(73.5) };
    const target = gripPoint(frame, resolveCockpit());
    const v = virtualFrameStackReach(target);
    expect(Math.abs(v.stack - frame.stack)).toBeLessThan(5);
    expect(Math.abs(v.reach - frame.reach)).toBeLessThan(5);
  });

  it('produces plausible road-bike numbers for a real body-derived target', () => {
    const target: BbPoint = { x: mm(594.1), y: mm(651.2) };
    const v = virtualFrameStackReach(target);
    expect(v.stack).toBeGreaterThan(400);
    expect(v.stack).toBeLessThan(800);
    expect(v.reach).toBeGreaterThan(300);
    expect(v.reach).toBeLessThan(500);
  });
});

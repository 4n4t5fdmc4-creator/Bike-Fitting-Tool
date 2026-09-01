import { describe, expect, it } from 'vitest';
import { deg, mm } from '../../domain/units';
import type { FrameCore } from '../forward';
import { decomposeHood, gripPoint } from '../forward';
import { resolveCockpit } from '../assumptions';

const frame = (stack: number, reach: number, hta: number): FrameCore => ({
  stack: mm(stack), reach: mm(reach), headTubeAngle: deg(hta),
});

const cockpit = (stemLength: number, stemAngle: number, spacerHeight: number, barReach = 80, barRise = 0) =>
  resolveCockpit({
    stemLength: mm(stemLength), stemAngle: deg(stemAngle), spacerHeight: mm(spacerHeight),
    barReach: mm(barReach), barRise: mm(barRise),
  });

// A spread that covers the plausible frame and cockpit ranges.
const FRAMES = [
  frame(520, 375, 71), frame(565, 395, 73), frame(600, 405, 74), frame(640, 420, 72.5),
];
const COCKPITS = [
  cockpit(70, -17, 0), cockpit(100, -6, 20), cockpit(120, 6, 35),
  cockpit(90, 0, 10, 70, 0), cockpit(110, -12, 25, 95, 25),
];

describe('hood decomposition', () => {
  it('the four contributions sum exactly to the hood, for a spread of frames and cockpits', () => {
    for (const f of FRAMES) {
      for (const c of COCKPITS) {
        const d = decomposeHood(f, c);
        const sumReach = d.frame.reach + d.stem.reach + d.spacer.reach + d.handlebar.reach;
        const sumStack = d.frame.stack + d.stem.stack + d.spacer.stack + d.handlebar.stack;
        expect(sumReach).toBeCloseTo(d.hood.reach, 9);
        expect(sumStack).toBeCloseTo(d.hood.stack, 9);
      }
    }
  });

  it('the hood equals the engine grip point, for the same spread', () => {
    for (const f of FRAMES) {
      for (const c of COCKPITS) {
        const d = decomposeHood(f, c);
        const g = gripPoint(f, c);
        expect(d.hood.reach).toBeCloseTo(g.x, 9);
        expect(d.hood.stack).toBeCloseTo(g.y, 9);
      }
    }
  });

  it('matches a hand-computed case', () => {
    // frame(565, 395, 73), 100 mm -6deg stem, 20 mm spacers, 80 mm bar, 0 rise.
    // theta = 90 - 73 - 6 = 11deg; h = 20 + 10 topcap + 20 half-clamp = 50.
    const d = decomposeHood(frame(565, 395, 73), cockpit(100, -6, 20));
    expect(d.frame).toEqual({ reach: 395, stack: 565 });
    expect(d.stem.reach).toBeCloseTo(98.16, 1);
    expect(d.stem.stack).toBeCloseTo(19.08, 1);
    expect(d.spacer.reach).toBeCloseTo(-14.62, 1);
    expect(d.spacer.stack).toBeCloseTo(47.82, 1);
    expect(d.handlebar).toEqual({ reach: 80 + 35, stack: 0 + 20 });
    expect(d.hood.reach).toBeCloseTo(593.5, 1);
    expect(d.hood.stack).toBeCloseTo(651.9, 1);
  });

  it('the cumulative points stack up to the hood', () => {
    const d = decomposeHood(frame(565, 395, 73), cockpit(100, -6, 20));
    expect(d.points.headTubeTop).toEqual({ x: 395, y: 565 });
    expect(d.points.hood.x).toBeCloseTo(d.hood.reach, 9);
    expect(d.points.hood.y).toBeCloseTo(d.hood.stack, 9);
  });
});

describe('one slider moves exactly one contribution row', () => {
  const f = frame(565, 395, 73);
  const base = { stem: 100, angle: -6, spacer: 20, barReach: 80, barRise: 0 };
  const d0 = decomposeHood(f, cockpit(base.stem, base.angle, base.spacer, base.barReach, base.barRise));

  const rowsEqual = (a: typeof d0, b: typeof d0, row: 'frame' | 'stem' | 'spacer' | 'handlebar') => {
    expect(a[row].reach).toBeCloseTo(b[row].reach, 9);
    expect(a[row].stack).toBeCloseTo(b[row].stack, 9);
  };
  const rowMoved = (a: typeof d0, b: typeof d0, row: 'frame' | 'stem' | 'spacer' | 'handlebar') => {
    const moved =
      Math.abs(a[row].reach - b[row].reach) > 0.5 || Math.abs(a[row].stack - b[row].stack) > 0.5;
    expect(moved).toBe(true);
  };

  it('stem length moves only the stem row', () => {
    const d = decomposeHood(f, cockpit(base.stem + 20, base.angle, base.spacer, base.barReach, base.barRise));
    rowMoved(d0, d, 'stem');
    rowsEqual(d0, d, 'frame');
    rowsEqual(d0, d, 'spacer');
    rowsEqual(d0, d, 'handlebar');
  });

  it('stem angle moves only the stem row', () => {
    const d = decomposeHood(f, cockpit(base.stem, base.angle - 11, base.spacer, base.barReach, base.barRise));
    rowMoved(d0, d, 'stem');
    rowsEqual(d0, d, 'frame');
    rowsEqual(d0, d, 'spacer');
    rowsEqual(d0, d, 'handlebar');
  });

  it('spacers move only the spacer row', () => {
    const d = decomposeHood(f, cockpit(base.stem, base.angle, base.spacer + 15, base.barReach, base.barRise));
    rowMoved(d0, d, 'spacer');
    rowsEqual(d0, d, 'frame');
    rowsEqual(d0, d, 'stem');
    rowsEqual(d0, d, 'handlebar');
  });

  it('bar reach moves only the handlebar row', () => {
    const d = decomposeHood(f, cockpit(base.stem, base.angle, base.spacer, base.barReach + 12, base.barRise));
    rowMoved(d0, d, 'handlebar');
    rowsEqual(d0, d, 'frame');
    rowsEqual(d0, d, 'stem');
    rowsEqual(d0, d, 'spacer');
  });

  it('bar rise moves only the handlebar row', () => {
    const d = decomposeHood(f, cockpit(base.stem, base.angle, base.spacer, base.barReach, base.barRise + 20));
    rowMoved(d0, d, 'handlebar');
    rowsEqual(d0, d, 'frame');
    rowsEqual(d0, d, 'stem');
    rowsEqual(d0, d, 'spacer');
  });
});

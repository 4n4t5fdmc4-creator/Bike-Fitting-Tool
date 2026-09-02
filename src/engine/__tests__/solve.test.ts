import { describe, expect, it } from 'vitest';
import { deg, mm } from '../../domain/units';
import type { FrameCore } from '../forward';
import { gripPoint } from '../forward';
import { resolveCockpit } from '../assumptions';
import { CATALOGUE_STEM_ANGLES, solveAll, solveForAngle } from '../solve';

const frame = (stack: number, reach: number, hta: number): FrameCore => ({
  stack: mm(stack), reach: mm(reach), headTubeAngle: deg(hta),
});

describe('the closed-form solve is exact', () => {
  // Property test: build a grip point forward, solve it back, and the cockpit
  // must be recovered to floating-point precision. If this ever fails, the
  // derivation in docs/scoring-engine.md section 5 is wrong.
  it('round-trips every frame and cockpit in the grid', () => {
    let checked = 0;
    for (const hta of [70, 71.5, 72, 73, 73.5, 74.5]) {
      for (const stack of [525, 565, 610, 660]) {
        for (const reach of [370, 385, 400, 415]) {
          for (const spacers of [0, 12.5, 20, 35]) {
            for (const stemLength of [70, 90, 110, 130]) {
              for (const stemAngle of CATALOGUE_STEM_ANGLES) {
                const f = frame(stack, reach, hta);
                const built = resolveCockpit({
                  spacerHeight: mm(spacers), stemLength: mm(stemLength), stemAngle,
                });
                const target = gripPoint(f, built);
                const solved = solveForAngle(f, target, stemAngle, built);
                expect(solved).not.toBeNull();
                expect(solved!.spacerHeight).toBeCloseTo(spacers, 9);
                expect(solved!.stemLength).toBeCloseTo(stemLength, 9);
                checked++;
              }
            }
          }
        }
      }
    }
    expect(checked).toBe(6 * 4 * 4 * 4 * 4 * CATALOGUE_STEM_ANGLES.length);
  });
});

describe('solve coverage', () => {
  it('produces one solution per catalogue angle, never fewer', () => {
    const f = frame(565, 395, 73.5);
    const c = resolveCockpit();
    const solutions = solveAll(f, gripPoint(f, c), c);
    expect(solutions).toHaveLength(CATALOGUE_STEM_ANGLES.length);
  });

  it('is never singular: the determinant is -cos(stemAngle)', () => {
    // cos is at its smallest over the catalogue at +-17 degrees, still 0.956.
    for (const a of CATALOGUE_STEM_ANGLES) {
      expect(Math.abs(Math.cos((a * Math.PI) / 180))).toBeGreaterThan(0.9);
    }
  });

  it('a longer frame needs a shorter stem, but NOT millimetre for millimetre', () => {
    // 20 mm of extra frame reach does not buy back 20 mm of stem. The stem sits
    // at an angle and the spacer height co-adjusts to hold the height, so the
    // exchange rate falls out of the linear system as
    //     dL = dReach * sin(headTubeAngle) / cos(stemAngle)
    // which is 19.28 mm here, not 20. Assuming 1:1 is a real sizing error.
    const rad = (d: number) => (d * Math.PI) / 180;
    const expected = (20 * Math.sin(rad(73.5))) / Math.cos(rad(-6));

    const c = resolveCockpit();
    const target = gripPoint(frame(565, 395, 73.5), c);
    const short = solveForAngle(frame(565, 385, 73.5), target, deg(-6), c);
    const long = solveForAngle(frame(565, 405, 73.5), target, deg(-6), c);

    expect(long!.stemLength).toBeLessThan(short!.stemLength);
    expect(short!.stemLength - long!.stemLength).toBeCloseTo(expected, 9);
    expect(expected).toBeCloseTo(19.28, 2);
  });
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_FIT_TOLERANCE, withinFitRadius, type FitTolerance } from '../fitRadius';

const tol: FitTolerance = { xs: 12, xl: 8, yl: 15, yh: 10 };

describe('fit tolerance', () => {
  it('is inside when every side is within its own bound', () => {
    expect(withinFitRadius(-12, -15, tol)).toBe(true);
    expect(withinFitRadius(8, 10, tol)).toBe(true);
    expect(withinFitRadius(0, 0, tol)).toBe(true);
  });

  it('bounds shorter and longer reach independently', () => {
    expect(withinFitRadius(-12, 0, tol)).toBe(true);
    expect(withinFitRadius(-13, 0, tol)).toBe(false);
    expect(withinFitRadius(8, 0, tol)).toBe(true);
    expect(withinFitRadius(9, 0, tol)).toBe(false); // longer is the tighter side
  });

  it('bounds lower and higher stack independently', () => {
    expect(withinFitRadius(0, -15, tol)).toBe(true);
    expect(withinFitRadius(0, -16, tol)).toBe(false);
    expect(withinFitRadius(0, 10, tol)).toBe(true);
    expect(withinFitRadius(0, 11, tol)).toBe(false);
  });

  it('is inclusive at the exact bound on every side', () => {
    expect(withinFitRadius(-12, 10, tol)).toBe(true);
    expect(withinFitRadius(8, -15, tol)).toBe(true);
  });

  it('ships the reference-tool defaults', () => {
    expect(DEFAULT_FIT_TOLERANCE).toEqual({ xs: 12, xl: 8, yl: 15, yh: 10 });
  });
});

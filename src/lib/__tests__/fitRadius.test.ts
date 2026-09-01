import { describe, expect, it } from 'vitest';
import { withinFitRadius } from '../fitRadius';

describe('fit radius', () => {
  it('is inside when both axes are within bound', () => {
    expect(withinFitRadius(10, 15, 15, 20)).toBe(true);
  });
  it('is outside when either axis exceeds its own bound', () => {
    expect(withinFitRadius(20, 5, 15, 20)).toBe(false);
    expect(withinFitRadius(5, 25, 15, 20)).toBe(false);
  });
  it('treats the bound as symmetric around zero', () => {
    expect(withinFitRadius(-15, -20, 15, 20)).toBe(true);
    expect(withinFitRadius(-16, 0, 15, 20)).toBe(false);
  });
  it('is inclusive at the exact bound', () => {
    expect(withinFitRadius(15, 20, 15, 20)).toBe(true);
  });
});

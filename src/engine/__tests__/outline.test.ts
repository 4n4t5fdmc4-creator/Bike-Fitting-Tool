import { describe, expect, it } from 'vitest';
import { deg, mm } from '../../domain/units';
import { frameOutline, outlineBounds } from '../outline';

const F = {
  stack: mm(565), reach: mm(395), headTubeAngle: deg(73.5), seatTubeAngle: deg(73.0),
  headTubeLength: mm(150), chainstay: mm(410),
};

describe('frame outline', () => {
  it('places the head tube exactly at stack/reach', () => {
    const o = frameOutline(F);
    expect(o.headTop.x).toBe(F.reach);
    expect(o.headTop.y).toBe(F.stack);
    expect(o.headTop.exact).toBe(true);
    expect(o.headBottom.exact).toBe(true);
  });

  it('marks fields with no source data as inexact', () => {
    const { headTubeLength, chainstay, ...bare } = F;
    void headTubeLength; void chainstay;
    const o = frameOutline(bare);
    expect(o.headTop.exact).toBe(true);   // still exact - stack/reach are always given
    expect(o.headBottom.exact).toBe(false);
    expect(o.rearAxle.exact).toBe(false);
    expect(o.seatTop.exact).toBe(false);  // never has a source field
    expect(o.frontAxle.exact).toBe(false); // never has a source field
    expect(o.fullyExact).toBe(false);
  });

  it('is fully exact only when head tube length and chainstay are both given', () => {
    expect(frameOutline(F).fullyExact).toBe(true);
  });

  it('keeps the head tube below and forward of its top, sloping the right way', () => {
    const o = frameOutline(F);
    expect(o.headBottom.x).toBeGreaterThan(o.headTop.x);
    expect(o.headBottom.y).toBeLessThan(o.headTop.y);
  });

  it('puts the seat top behind and above the BB', () => {
    const o = frameOutline(F);
    expect(o.seatTop.x).toBeLessThan(0);
    expect(o.seatTop.y).toBeGreaterThan(0);
  });

  it('bounds grow to cover every supplied frame', () => {
    const small = frameOutline({ ...F, stack: mm(500), reach: mm(370) });
    const large = frameOutline({ ...F, stack: mm(650), reach: mm(420) });
    const b1 = outlineBounds([small]);
    const b2 = outlineBounds([small, large]);
    expect(b2.maxY).toBeGreaterThanOrEqual(b1.maxY);
    expect(b2.maxX).toBeGreaterThanOrEqual(b1.maxX);
  });
});

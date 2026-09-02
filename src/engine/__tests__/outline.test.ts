import { describe, expect, it } from 'vitest';
import { deg, mm } from '../../domain/units';
import { frameOutline, outlineBounds } from '../outline';

const F = {
  stack: mm(565), reach: mm(395), headTubeAngle: deg(73.5), seatTubeAngle: deg(73.0),
  headTubeLength: mm(150), chainstay: mm(410),
  effectiveTopTube: mm(560), wheelbase: mm(1000), bbDrop: mm(70),
};

describe('frame outline', () => {
  it('places the head tube exactly at stack/reach', () => {
    const o = frameOutline(F);
    expect(o.htTop.x).toBe(F.reach);
    expect(o.htTop.y).toBe(F.stack);
    expect(o.htTop.exact).toBe(true);
    expect(o.htBot.exact).toBe(true);
  });

  it('draws a horizontal top tube - seat-tube junction sits at stack height', () => {
    const o = frameOutline(F);
    expect(o.stTop.y).toBe(F.stack);
    expect(o.stTop.x).toBe(F.reach - F.effectiveTopTube);
    expect(o.stTop.x).toBeLessThan(o.htTop.x);
  });

  it('puts both axles on one ground line at bb drop', () => {
    const o = frameOutline(F);
    expect(o.rear.y).toBe(F.bbDrop);
    expect(o.front.y).toBe(F.bbDrop);
    expect(o.rear.x).toBeLessThan(0);
    expect(o.front.x).toBeGreaterThan(0);
    expect(o.front.x - o.rear.x).toBe(F.wheelbase);
  });

  it('marks fields with no source data as inexact and falls back', () => {
    const bare = {
      stack: mm(565), reach: mm(395), headTubeAngle: deg(73.5), seatTubeAngle: deg(73.0),
    };
    const o = frameOutline(bare);
    expect(o.htTop.exact).toBe(true); // stack/reach are always given
    expect(o.htBot.exact).toBe(false);
    expect(o.stTop.exact).toBe(false);
    expect(o.rear.exact).toBe(false);
    expect(o.front.exact).toBe(false);
    expect(o.fullyExact).toBe(false);
    // still a drawable bike
    expect(o.stTop.y).toBe(bare.stack);
    expect(o.rear.x).toBeLessThan(0);
  });

  it('is fully exact only when the front triangle comes entirely from data', () => {
    expect(frameOutline(F).fullyExact).toBe(true);
    const { chainstay, ...noCs } = F;
    void chainstay;
    expect(frameOutline(noCs).fullyExact).toBe(false);
  });

  it('keeps the head tube below and forward of its top, sloping the right way', () => {
    const o = frameOutline(F);
    expect(o.htBot.x).toBeGreaterThan(o.htTop.x);
    expect(o.htBot.y).toBeLessThan(o.htTop.y);
  });

  it('puts the seatpost top behind and above the BB', () => {
    const o = frameOutline(F);
    expect(o.spTop.x).toBeLessThan(0);
    expect(o.spTop.y).toBeGreaterThan(0);
  });

  it('scales wheel radius with tyre clearance', () => {
    const road = frameOutline(F);
    const gravel = frameOutline({ ...F, tyreMax: mm(45) });
    expect(gravel.wheelRadius).toBeGreaterThan(road.wheelRadius);
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

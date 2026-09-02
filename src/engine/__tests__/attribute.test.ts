import { describe, expect, it } from 'vitest';
import { deg, mm } from '../../domain/units';
import type { FrameCore } from '../forward';
import { resolveCockpit } from '../assumptions';
import { attribute } from '../attribute';

const frame = (stack: number, reach: number, hta: number): FrameCore => ({
  stack: mm(stack), reach: mm(reach), headTubeAngle: deg(hta),
});

const C = resolveCockpit();

describe('delta attribution', () => {
  it('assigns a pure reach change entirely to reach', () => {
    const a = attribute(frame(565, 395, 73.5), frame(565, 409, 73.5), C);
    expect(a.totalDeltaX).toBeCloseTo(14, 6);
    expect(a.terms[0]!.property).toBe('reach');
    expect(a.terms[0]!.deltaX).toBeCloseTo(14, 6);
    expect(a.residual.x).toBeCloseTo(0, 6);
  });

  it('assigns a pure stack change entirely to stack', () => {
    const a = attribute(frame(565, 395, 73.5), frame(583, 395, 73.5), C);
    expect(a.totalDeltaY).toBeCloseTo(18, 6);
    expect(a.terms[0]!.property).toBe('stack');
    expect(a.residual.y).toBeCloseTo(0, 6);
  });

  it('ranks terms by how far each moved the grip point', () => {
    const a = attribute(frame(565, 395, 73.5), frame(583, 409, 71.5), C);
    const sizes = a.terms.map((t) => Math.hypot(t.deltaX, t.deltaY));
    expect(sizes).toEqual([...sizes].sort((x, y) => y - x));
  });

  it('reports interaction as a residual rather than smearing it across terms', () => {
    const a = attribute(frame(565, 395, 73.5), frame(600, 415, 70.5), C);
    const sumX = a.terms.reduce((s, t) => s + t.deltaX, 0);
    expect(a.totalDeltaX - sumX).toBeCloseTo(a.residual.x, 9);
  });

  it('finds no difference between a frame and itself', () => {
    const a = attribute(frame(565, 395, 73.5), frame(565, 395, 73.5), C);
    expect(a.totalDeltaX).toBeCloseTo(0, 9);
    expect(a.totalDeltaY).toBeCloseTo(0, 9);
    expect(a.terms.every((t) => Math.hypot(t.deltaX, t.deltaY) < 1e-9)).toBe(true);
  });
});

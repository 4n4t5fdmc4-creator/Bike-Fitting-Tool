/**
 * One shared mm -> SVG coordinate transform. Every overlay layer uses this, so
 * two frames can never end up drawn at different scales - see
 * docs/app-architecture.md section 6.2.
 */

export interface Projection {
  readonly toSvgX: (mmX: number) => number;
  readonly toSvgY: (mmY: number) => number;
  readonly scale: number;
  readonly viewBox: string;
}

export function makeProjection(
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  width: number,
  height: number,
  pad = 24,
): Projection {
  const spanX = Math.max(1, bounds.maxX - bounds.minX);
  const spanY = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);

  const toSvgX = (x: number) => pad + (x - bounds.minX) * scale;
  // SVG y grows downward; the domain's y grows upward. Single flip, here only.
  const toSvgY = (y: number) => pad + (bounds.maxY - y) * scale;

  return { toSvgX, toSvgY, scale, viewBox: `0 0 ${width} ${height}` };
}

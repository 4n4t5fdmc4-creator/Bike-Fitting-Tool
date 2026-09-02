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

export interface Bounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

/**
 * Widen whichever axis is the sliver until the box is at least `ratio` wide for
 * its height, growing it symmetrically so nothing shifts off centre.
 *
 * Fit data is naturally portrait: a size run spans ~150 mm of stack but only
 * ~90 mm of reach. Drawn at a uniform mm scale — which is not negotiable, a
 * 10 mm move must read the same length on both axes — that produces a tall,
 * narrow plot that can only ever occupy a third of a page-width container, with
 * the dots stacked in a column and no room for their labels.
 *
 * Adding empty millimetres is the honest fix: the scale stays uniform, the
 * axes stay true, and what changes is only how much blank space surrounds the
 * data. Squashing the axes to fit the container would not be honest.
 */
export function withMinAspect(b: Bounds, ratio: number): Bounds {
  const spanX = b.maxX - b.minX;
  const spanY = b.maxY - b.minY;
  if (spanX >= spanY * ratio) return b;
  const grow = (spanY * ratio - spanX) / 2;
  return { ...b, minX: b.minX - grow, maxX: b.maxX + grow };
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

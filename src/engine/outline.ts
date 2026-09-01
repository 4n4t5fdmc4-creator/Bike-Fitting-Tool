/**
 * Schematic frame outline for the overlay chart.
 *
 * Deliberately NOT a precise CAD drawing. The stored library only carries
 * stack, reach, the two tube angles, head tube length and chainstay - a
 * geometry table never publishes wheelbase, fork rake or exact seat tube
 * length as a routine matter, and guessing them for a picture would be the
 * anti-pattern this whole project exists to avoid: a plausible-looking number
 * nobody measured.
 *
 * So the outline is split honestly: the head tube (top, bottom, length) is
 * EXACT, taken straight from stack/reach/HTA/headTubeLength. Seat tube,
 * chainstay and the wheels are TYPICAL - drawn from road-bike defaults so the
 * picture reads as a bike, with `exact: false` carried on each so the caller
 * can render them differently (lighter, dashed) and the chart can say so.
 */

import type { BbPoint, Degrees, Millimeters } from '../domain/units';
import { mm, toRad } from '../domain/units';

export interface OutlineFrame {
  readonly stack: Millimeters;
  readonly reach: Millimeters;
  readonly headTubeAngle: Degrees;
  readonly seatTubeAngle: Degrees;
  readonly headTubeLength?: Millimeters;
  readonly chainstay?: Millimeters;
}

export interface OutlinePoint extends BbPoint {
  readonly exact: boolean;
}

export interface FrameOutline {
  readonly bb: OutlinePoint;
  readonly headTop: OutlinePoint;
  readonly headBottom: OutlinePoint;
  readonly seatTop: OutlinePoint;
  readonly rearAxle: OutlinePoint;
  readonly frontAxle: OutlinePoint;
  /** Whether every point is from measured fields, for a one-line disclosure. */
  readonly fullyExact: boolean;
}

/** Typical road-bike values used only where the library has no field for it. */
const TYPICAL = {
  headTubeLength: 150,
  chainstay: 410,
  bbDrop: 70,
  wheelRadius: 335,
  seatMastAboveStack: 60,
} as const;

export function frameOutline(f: OutlineFrame): FrameOutline {
  const hta = toRad(f.headTubeAngle);
  const sta = toRad(f.seatTubeAngle);
  const headTubeLength = f.headTubeLength ?? mm(TYPICAL.headTubeLength);
  const chainstay = f.chainstay ?? mm(TYPICAL.chainstay);
  const bbDrop = TYPICAL.bbDrop;

  const bb: OutlinePoint = { x: mm(0), y: mm(0), exact: true };
  const headTop: OutlinePoint = { x: f.reach, y: f.stack, exact: true };
  const headBottom: OutlinePoint = {
    x: mm(headTop.x + headTubeLength * Math.cos(hta)),
    y: mm(headTop.y - headTubeLength * Math.sin(hta)),
    exact: f.headTubeLength !== undefined,
  };

  // Seat tube length has no field in the library. A length is chosen so the
  // seat top sits at a plausible saddle-ish height above stack - decorative,
  // never used for anything the engine scores.
  const seatLen = (f.stack + TYPICAL.seatMastAboveStack) / Math.sin(sta);
  const seatTop: OutlinePoint = {
    x: mm(-seatLen * Math.cos(sta)),
    y: mm(seatLen * Math.sin(sta)),
    exact: false,
  };

  const rearAxle: OutlinePoint = {
    x: mm(-Math.sqrt(Math.max(0, chainstay * chainstay - bbDrop * bbDrop))),
    y: mm(bbDrop),
    exact: f.chainstay !== undefined,
  };

  // No wheelbase field either - the front axle is placed at a typical
  // front-centre offset from the head tube bottom along the fork line.
  const forkLength = 370;
  const frontAxle: OutlinePoint = {
    x: mm(headBottom.x + forkLength * Math.cos(hta)),
    y: mm(headBottom.y - forkLength * Math.sin(hta) + bbDrop),
    exact: false,
  };

  return {
    bb, headTop, headBottom, seatTop, rearAxle, frontAxle,
    fullyExact: f.headTubeLength !== undefined && f.chainstay !== undefined,
  };
}

export const OUTLINE_WHEEL_RADIUS = TYPICAL.wheelRadius;

/** Bounding box across several outlines, so every layer shares one scale. */
export function outlineBounds(
  outlines: ReadonlyArray<FrameOutline>,
  wheelRadius: number = TYPICAL.wheelRadius,
): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = 0, maxX = 0, minY = -20, maxY = 0;
  for (const o of outlines) {
    const xs = [o.rearAxle.x - wheelRadius, o.frontAxle.x + wheelRadius, o.seatTop.x, o.headTop.x];
    const ys = [o.rearAxle.y - wheelRadius, o.frontAxle.y - wheelRadius, o.seatTop.y + 40, o.headTop.y];
    minX = Math.min(minX, ...xs); maxX = Math.max(maxX, ...xs);
    minY = Math.min(minY, ...ys); maxY = Math.max(maxY, ...ys);
  }
  return { minX, maxX, minY, maxY };
}

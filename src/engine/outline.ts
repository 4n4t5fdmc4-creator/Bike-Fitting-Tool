/**
 * Schematic side-view of a frame for the overlay chart.
 *
 * Deliberately NOT a precise CAD drawing. The stored library carries a
 * different subset of geometry for every brand - a table never publishes
 * wheelbase, fork rake and effective top tube together as a routine matter,
 * and inventing them for a picture would be the anti-pattern this project
 * exists to avoid: a plausible-looking number nobody measured.
 *
 * So every point carries an `exact` flag. The head tube (top, bottom, length)
 * is EXACT, straight from stack / reach / HTA / headTubeLength. Anything that
 * needs a field the library may not have - effective top tube, chainstay,
 * wheelbase, bb drop, the cockpit - falls back to a typical road-bike value
 * and is marked `exact: false`, so the caller can draw it lighter and the
 * chart can say which lines are guessed.
 *
 * Geometry, all BB-relative, +x forward, +y up:
 *
 *   bb     = (0, 0)
 *   htTop  = (reach, stack)
 *   htBot  = (reach + ht·cos hta, stack − ht·sin hta)
 *   stTop  = (reach − effectiveTopTube, stack)              ← top tube is HORIZONTAL
 *   spTop  = stTop − 110 along the seat-tube angle          ← seatpost above the junction
 *   rear   = (−√(cs² − bbDrop²), bbDrop)
 *   front  = (rear.x + wheelbase, bbDrop)                   ← both axles on one ground line
 *   spacer = htTop − sp along the steerer axis
 *   clamp  = spacer + L at θ = (90 − hta) + stemAngle
 *   hood   = clamp + (barReach, barRise)
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
  readonly effectiveTopTube?: Millimeters;
  readonly wheelbase?: Millimeters;
  readonly bbDrop?: Millimeters;
  readonly tyreMax?: Millimeters;
  /** Spacer stack under the stem. */
  readonly spacerStack?: Millimeters;
  readonly stemLength?: Millimeters;
  readonly stemAngle?: Degrees;
  readonly barReach?: Millimeters;
  readonly barRise?: Millimeters;
}

export interface OutlinePoint extends BbPoint {
  readonly exact: boolean;
}

export interface FrameOutline {
  readonly bb: OutlinePoint;
  /** Head tube top, at stack / reach - always exact. */
  readonly htTop: OutlinePoint;
  readonly htBot: OutlinePoint;
  /** Where the top tube meets the seat tube, at stack height. */
  readonly stTop: OutlinePoint;
  /** Top of the seatpost, above the junction. */
  readonly spTop: OutlinePoint;
  readonly rear: OutlinePoint;
  readonly front: OutlinePoint;
  /** Top of the spacer stack on the steerer. */
  readonly spacer: OutlinePoint;
  /** Stem / handlebar clamp. */
  readonly clamp: OutlinePoint;
  /** The hood, where the hands sit. */
  readonly hood: OutlinePoint;
  /** Wheel radius for this frame, from its tyre clearance. */
  readonly wheelRadius: number;
  /** Whether the closed front triangle is drawn entirely from measured fields. */
  readonly fullyExact: boolean;
}

/** Typical road-bike values, used only where the library has no field for it. */
const TYPICAL = {
  headTubeLength: 150,
  chainstay: 415,
  bbDrop: 70,
  tyreMax: 30,
  seatpostShown: 110,
  spacerStack: 20,
  stemLength: 100,
  stemAngle: -6,
  barReach: 80,
  barRise: 0,
  forkReach: 390,
} as const;

/** 622 mm BSD -> 311 mm rim radius, plus half the tyre. */
const RIM_RADIUS = 311;

export function frameOutline(f: OutlineFrame): FrameOutline {
  const hta = toRad(f.headTubeAngle);
  const sta = toRad(f.seatTubeAngle);

  const ht = f.headTubeLength ?? mm(TYPICAL.headTubeLength);
  const cs = f.chainstay ?? mm(TYPICAL.chainstay);
  const bbDrop = f.bbDrop ?? mm(TYPICAL.bbDrop);
  const tyreMax = f.tyreMax ?? mm(TYPICAL.tyreMax);
  const sp = f.spacerStack ?? mm(TYPICAL.spacerStack);
  const stemLen = f.stemLength ?? mm(TYPICAL.stemLength);
  const stemAngle = f.stemAngle ?? (TYPICAL.stemAngle as Degrees);
  const barReach = f.barReach ?? mm(TYPICAL.barReach);
  const barRise = f.barRise ?? mm(TYPICAL.barRise);

  const bb: OutlinePoint = { x: mm(0), y: mm(0), exact: true };

  const htTop: OutlinePoint = { x: f.reach, y: f.stack, exact: true };
  const htBot: OutlinePoint = {
    x: mm(htTop.x + ht * Math.cos(hta)),
    y: mm(htTop.y - ht * Math.sin(hta)),
    exact: f.headTubeLength !== undefined,
  };

  // Effective top tube: horizontal run from the head-tube top back to the seat
  // tube, at stack height. Where the library omits it, fall back to the seat
  // tube's own horizontal offset at that height (stack / tan sta).
  const eTT = f.effectiveTopTube ?? mm(f.reach + f.stack / Math.tan(sta));
  const stTop: OutlinePoint = {
    x: mm(f.reach - eTT),
    y: f.stack,
    exact: f.effectiveTopTube !== undefined,
  };
  const spTop: OutlinePoint = {
    x: mm(stTop.x - TYPICAL.seatpostShown * Math.cos(sta)),
    y: mm(stTop.y + TYPICAL.seatpostShown * Math.sin(sta)),
    exact: false, // the shown seatpost length is decorative
  };

  const rear: OutlinePoint = {
    x: mm(-Math.sqrt(Math.max(0, cs * cs - bbDrop * bbDrop))),
    y: bbDrop,
    exact: f.chainstay !== undefined && f.bbDrop !== undefined,
  };

  // Front axle on the same ground line. With a wheelbase it is exact; without,
  // it is placed a typical fork-reach forward of the head-tube bottom.
  const frontX =
    f.wheelbase !== undefined
      ? rear.x + f.wheelbase
      : htBot.x + TYPICAL.forkReach * Math.cos(hta);
  const front: OutlinePoint = {
    x: mm(frontX),
    y: bbDrop,
    exact: f.wheelbase !== undefined && rear.exact,
  };

  const spacer: OutlinePoint = {
    x: mm(htTop.x - sp * Math.cos(hta)),
    y: mm(htTop.y + sp * Math.sin(hta)),
    exact: f.spacerStack !== undefined,
  };
  const theta = toRad(((90 - f.headTubeAngle + stemAngle) as Degrees));
  const clamp: OutlinePoint = {
    x: mm(spacer.x + stemLen * Math.cos(theta)),
    y: mm(spacer.y + stemLen * Math.sin(theta)),
    exact:
      f.spacerStack !== undefined && f.stemLength !== undefined && f.stemAngle !== undefined,
  };
  const hood: OutlinePoint = {
    x: mm(clamp.x + barReach),
    y: mm(clamp.y + barRise),
    exact: clamp.exact && f.barReach !== undefined && f.barRise !== undefined,
  };

  return {
    bb, htTop, htBot, stTop, spTop, rear, front, spacer, clamp, hood,
    wheelRadius: RIM_RADIUS + tyreMax / 2,
    fullyExact: htBot.exact && stTop.exact && rear.exact,
  };
}

/** Wheel radius drawn when a frame carries no tyre-clearance field. */
export const TYPICAL_WHEEL_RADIUS = RIM_RADIUS + TYPICAL.tyreMax / 2;

/** Bounding box across several outlines, so every layer shares one scale. */
export function outlineBounds(
  outlines: ReadonlyArray<FrameOutline>,
): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = 0, maxX = 0, minY = -20, maxY = 0;
  for (const o of outlines) {
    const r = o.wheelRadius;
    const xs = [
      o.rear.x - r, o.front.x + r, o.spTop.x, o.htTop.x, o.hood.x, o.clamp.x,
    ];
    const ys = [
      o.rear.y - r, o.front.y - r, o.spTop.y + 40, o.htTop.y, o.hood.y, o.spacer.y,
    ];
    minX = Math.min(minX, ...xs); maxX = Math.max(maxX, ...xs);
    minY = Math.min(minY, ...ys); maxY = Math.max(maxY, ...ys);
  }
  return { minX, maxX, minY, maxY };
}

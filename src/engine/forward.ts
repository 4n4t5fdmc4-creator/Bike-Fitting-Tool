/**
 * Forward model: frame geometry plus a cockpit produces contact points.
 *
 * Everything here is pure. No React, no browser APIs, no imports outside the
 * domain layer - see docs/app-architecture.md section 3.
 */

import type { BbPoint, Degrees, Millimeters } from '../domain/units';
import { mm, toRad } from '../domain/units';

/** The frame properties the forward model needs. */
export interface FrameCore {
  readonly stack: Millimeters;
  readonly reach: Millimeters;
  readonly headTubeAngle: Degrees;
}

/**
 * A fully resolved cockpit. Every assumption has already been substituted, so
 * this model never guesses - resolution happens once, in `assumptions.ts`.
 */
export interface ResolvedCockpit {
  readonly spacerHeight: Millimeters;
  readonly stemLength: Millimeters;
  /**
   * Signed, in the manufacturer's convention: measured against the
   * perpendicular of the steering axis. On a 73 degree head angle a -17 degree
   * stem sits exactly horizontal and a -6 degree stem still rises 11 degrees.
   */
  readonly stemAngle: Degrees;
  /** Headset top cap plus compression ring. Part of the stack, never counted by riders. */
  readonly topCapHeight: Millimeters;
  /** Height of the stem's steerer clamp; its centre is half way up. */
  readonly stemClampHeight: Millimeters;
  readonly barReach: Millimeters;
  readonly barRise: Millimeters;
  readonly barRotation: Degrees;
  readonly hoodForward: Millimeters;
  readonly hoodRise: Millimeters;
}

/**
 * Rise along the steering axis from the top of the head tube to the centre of
 * the stem's bar clamp.
 *
 * `stemClampHeight / 2` because the bar clamp sits at the mid-height of the
 * steerer clamp, not at its base.
 */
export function steererRise(c: ResolvedCockpit): number {
  return c.spacerHeight + c.topCapHeight + c.stemClampHeight / 2;
}

/** Stem angle above the horizontal. Zero means the stem is level. */
export function stemAngleAboveHorizontal(
  frame: FrameCore,
  cockpit: ResolvedCockpit,
): Degrees {
  return (90 - frame.headTubeAngle + cockpit.stemAngle) as Degrees;
}

/** Horizontal and vertical offset from the bar clamp to the hood grip. */
export function hoodOffset(c: ResolvedCockpit): { dx: number; dy: number } {
  const forward = c.barReach + c.hoodForward;
  const phi = toRad(c.barRotation);
  return {
    dx: forward * Math.cos(phi),
    dy: forward * Math.sin(phi) + c.hoodRise + c.barRise,
  };
}

/** Centre of the handlebar at the stem clamp, relative to the bottom bracket. */
export function barClampPoint(frame: FrameCore, cockpit: ResolvedCockpit): BbPoint {
  const u = steererRise(cockpit);
  const hta = toRad(frame.headTubeAngle);
  const theta = toRad(stemAngleAboveHorizontal(frame, cockpit));
  return {
    x: mm(frame.reach - u * Math.cos(hta) + cockpit.stemLength * Math.cos(theta)),
    y: mm(frame.stack + u * Math.sin(hta) + cockpit.stemLength * Math.sin(theta)),
  };
}

/**
 * The grip point: hood grip centre relative to the bottom bracket.
 *
 * This is the primary fit axis. `grip.x` is grip reach, `grip.y` is grip stack.
 */
export function gripPoint(frame: FrameCore, cockpit: ResolvedCockpit): BbPoint {
  const bar = barClampPoint(frame, cockpit);
  const { dx, dy } = hoodOffset(cockpit);
  return { x: mm(bar.x + dx), y: mm(bar.y + dy) };
}

/** One axis pair of a hood-position contribution, in millimetres. */
export interface HoodTerm {
  readonly reach: number;
  readonly stack: number;
}

/**
 * The hood grip, broken into the four things that put it there. The four reach
 * terms sum to grip reach and the four stack terms to grip stack, exactly - so
 * an A/B difference can be read off as living in the frame, the stem, the
 * steerer stack or the bar, and priced accordingly.
 */
export interface HoodDecomposition {
  /** Head tube top: the frame's own reach and stack. */
  readonly frame: HoodTerm;
  /** `L·cos θ, L·sin θ` - the stem, at θ above horizontal. */
  readonly stem: HoodTerm;
  /** `−h·cos(hta), h·sin(hta)` - the rise up the steerer: spacers, top cap and half the stem clamp. */
  readonly spacer: HoodTerm;
  /** Bar reach and rise, plus the lever tip's own forward-and-up offset. */
  readonly handlebar: HoodTerm;
  /** Where the hands are. Equal, to the float, to {@link gripPoint}. */
  readonly hood: HoodTerm;
  /** Cumulative points for drawing, in the order the parts stack up the steerer. */
  readonly points: {
    readonly headTubeTop: BbPoint;
    readonly steererTop: BbPoint;
    readonly clamp: BbPoint;
    readonly hood: BbPoint;
  };
}

export function decomposeHood(frame: FrameCore, cockpit: ResolvedCockpit): HoodDecomposition {
  const hta = toRad(frame.headTubeAngle);
  const theta = toRad(stemAngleAboveHorizontal(frame, cockpit));
  const u = steererRise(cockpit);
  const bar = hoodOffset(cockpit);

  const frameT: HoodTerm = { reach: frame.reach, stack: frame.stack };
  const spacerT: HoodTerm = { reach: -u * Math.cos(hta), stack: u * Math.sin(hta) };
  const stemT: HoodTerm = {
    reach: cockpit.stemLength * Math.cos(theta),
    stack: cockpit.stemLength * Math.sin(theta),
  };
  const handlebarT: HoodTerm = { reach: bar.dx, stack: bar.dy };

  const headTubeTop: BbPoint = { x: mm(frameT.reach), y: mm(frameT.stack) };
  const steererTop: BbPoint = {
    x: mm(headTubeTop.x + spacerT.reach),
    y: mm(headTubeTop.y + spacerT.stack),
  };
  const clamp: BbPoint = {
    x: mm(steererTop.x + stemT.reach),
    y: mm(steererTop.y + stemT.stack),
  };
  const hoodP: BbPoint = { x: mm(clamp.x + handlebarT.reach), y: mm(clamp.y + handlebarT.stack) };

  return {
    frame: frameT,
    stem: stemT,
    spacer: spacerT,
    handlebar: handlebarT,
    hood: { reach: hoodP.x, stack: hoodP.y },
    points: { headTubeTop, steererTop, clamp, hood: hoodP },
  };
}

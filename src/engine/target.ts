/**
 * Deriving a target position from body measurements.
 *
 * These are RICHTWERTE - established rules of thumb, not a bike fit. They
 * narrow the frame search; they do not tell anyone how they should sit. The
 * confidence band on the result says so, and the UI must repeat it.
 *
 * The primary output is the BB-relative grip point, because that is the axis the
 * whole engine works in. Saddle height and setback come along for the saddle
 * feasibility gate.
 */

import type { BbPoint, Degrees, Millimeters } from '../domain/units';
import { deg, mm, toRad } from '../domain/units';

export type RidingStyle = 'comfort' | 'allround' | 'performance';
export type Flexibility = 'limited' | 'average' | 'good';

export interface BodyInput {
  /** Barefoot standing height. */
  readonly height: Millimeters;
  /** Floor to crotch, measured with a book pulled up firmly - NOT trouser inseam. */
  readonly inseam: Millimeters;
  readonly style: RidingStyle;
  readonly flexibility: Flexibility;
}

export interface DerivedTarget {
  /** The primary axis: BB to hood grip centre. */
  readonly grip: BbPoint;
  /** BB to saddle top, along the seat tube axis. */
  readonly saddleHeight: Millimeters;
  /** BB to the 70 mm saddle-width point, positive = behind the BB. */
  readonly saddleSetback: Millimeters;
  /** Saddle top above the hood grip. Reported because riders think in drop. */
  readonly drop: Millimeters;
  /** Half-width of the plausible band, in mm. Wide on purpose. */
  readonly uncertainty: Millimeters;
}

/**
 * Saddle height as a fraction of inseam. LeMond's 0.883, measured BB centre to
 * saddle top along the seat tube axis.
 */
const SADDLE_HEIGHT_FACTOR = 0.883;

/**
 * Horizontal distance from the 70 mm saddle-width point to the hood grip, as a
 * fraction of height. Calibrated so that a 180 cm allround rider lands on the
 * position a well-fitted 56 cm race frame produces - see target.test.ts.
 */
const REACH_FACTOR: Record<RidingStyle, number> = {
  comfort: 0.415,
  allround: 0.425,
  performance: 0.435,
};

/** Saddle top above the hood grip, at 1800 mm of rider height. */
const DROP_BASE: Record<RidingStyle, number> = {
  comfort: 25,
  allround: 60,
  performance: 95,
};

/** Flexibility shifts how much drop is tolerable, in mm. */
const DROP_BY_FLEXIBILITY: Record<Flexibility, number> = {
  limited: -15,
  average: 0,
  good: 15,
};

/** Seat tube angle assumed before a specific frame is known. */
export const ASSUMED_SEAT_ANGLE: Degrees = deg(73.5);

/** Clamp to a 70 mm saddle-width point offset when the saddle is unknown. */
const ASSUMED_WIDTH_POINT_OFFSET = 40;

export function deriveTarget(
  body: BodyInput,
  seatTubeAngle: Degrees = ASSUMED_SEAT_ANGLE,
): DerivedTarget {
  const saddleHeight = body.inseam * SADDLE_HEIGHT_FACTOR;

  // Where the saddle reference point ends up on an assumed seat angle.
  const sta = toRad(seatTubeAngle);
  const saddleX = -saddleHeight * Math.cos(sta) + ASSUMED_WIDTH_POINT_OFFSET;
  const saddleTopY = saddleHeight * Math.sin(sta);

  const reach = body.height * REACH_FACTOR[body.style];
  const drop =
    DROP_BASE[body.style] * (body.height / 1800) + DROP_BY_FLEXIBILITY[body.flexibility];

  return {
    grip: { x: mm(saddleX + reach), y: mm(saddleTopY - drop) },
    saddleHeight: mm(saddleHeight),
    saddleSetback: mm(-saddleX),
    drop: mm(drop),
    // A derived target is a band, not a point. Anything narrower would be a lie:
    // two riders of the same height routinely differ by this much.
    uncertainty: mm(20),
  };
}

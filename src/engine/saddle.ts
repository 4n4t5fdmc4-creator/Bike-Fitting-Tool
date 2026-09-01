/**
 * Saddle feasibility.
 *
 * The saddle is a CONSTRAINT, not a scoring axis. Seatpost setback comes in
 * four catalogue values and rails give 25-30 mm each way, so an unreachable
 * saddle is a gate and a near-limit saddle is a minor penalty - but it never
 * drives the score. See docs/product-spec.md principle P0.
 */

import type { Degrees, Millimeters } from '../domain/units';
import { mm, toRad } from '../domain/units';

export interface SeatpostOption {
  readonly setback: Millimeters;
  readonly railTravel: Millimeters;
}

export const CATALOGUE_SEATPOSTS: ReadonlyArray<SeatpostOption> = [
  { setback: mm(0), railTravel: mm(25) },
  { setback: mm(15), railTravel: mm(25) },
  { setback: mm(20), railTravel: mm(25) },
  { setback: mm(25), railTravel: mm(25) },
];

export interface SaddleTarget {
  /** BB to saddle top, along the seat tube axis. */
  readonly height: Millimeters;
  /** Horizontal BB to the 70 mm saddle-width point. Positive = behind the BB. */
  readonly setback: Millimeters;
}

export type SaddleResult =
  | {
      readonly kind: 'reachable';
      readonly post: SeatpostOption;
      /** Rail offset needed, positive forwards. */
      readonly railOffset: Millimeters;
      /** How much rail travel is left. Small values earn a minor penalty. */
      readonly margin: Millimeters;
    }
  | {
      readonly kind: 'unreachable';
      /** How far past the best available combination, in mm. */
      readonly shortfall: Millimeters;
    };

/**
 * Can this frame's seat angle put the saddle where the rider needs it?
 *
 * @param widthPointOffset horizontal rail-clamp to 70 mm width point, per saddle
 */
export function evaluateSaddle(
  seatTubeAngle: Degrees,
  target: SaddleTarget,
  widthPointOffset: Millimeters,
  posts: ReadonlyArray<SeatpostOption> = CATALOGUE_SEATPOSTS,
): SaddleResult {
  const postAxisX = -target.height * Math.cos(toRad(seatTubeAngle));
  let best: SaddleResult = { kind: 'unreachable', shortfall: mm(Infinity) };

  for (const post of posts) {
    const clampX = postAxisX - post.setback;
    const noseX = clampX + widthPointOffset;
    // Rail offset that moves the reference point onto the target.
    const needed = -target.setback - noseX;
    const over = Math.abs(needed) - post.railTravel;

    if (over <= 0) {
      const margin = mm(-over);
      if (best.kind !== 'reachable' || margin > best.margin) {
        best = { kind: 'reachable', post, railOffset: mm(needed), margin };
      }
    } else if (best.kind === 'unreachable' && over < best.shortfall) {
      best = { kind: 'unreachable', shortfall: mm(over) };
    }
  }
  return best;
}

/**
 * Inverse model: what cockpit puts the grip point on target?
 *
 * This is NOT a search. Inverting the forward model for a fixed stem angle
 * leaves two linear equations in two unknowns, and the determinant collapses to
 * -cos(stemAngle), which is never zero over the catalogue range. So the whole
 * optimisation is one closed-form evaluation per catalogue angle - six of them.
 *
 * See docs/scoring-engine.md section 5 for the derivation.
 */

import type { BbPoint, Degrees, Millimeters } from '../domain/units';
import { deg, mm, toRad } from '../domain/units';
import type { FrameCore, ResolvedCockpit } from './forward';
import { hoodOffset } from './forward';

/**
 * Stem angles a shop actually stocks.
 *
 * 0 degrees is deliberately absent. It exists, but it is rare on drop-bar bikes:
 * the catalogues are dominated by +-6 (often labelled 7 or 8) and +-17, with
 * +-12 from a few brands. Recommending an angle a rider cannot easily buy is
 * worse than recommending the next one along, and the solver will happily find
 * an equivalent build at a stocked angle.
 *
 * A reference bike can still be entered with any angle - this list constrains
 * what is RECOMMENDED, not what can be described.
 */
export const CATALOGUE_STEM_ANGLES: ReadonlyArray<Degrees> = [
  deg(-17), deg(-12), deg(-8), deg(-6), deg(6), deg(8), deg(12), deg(17),
];

export interface CockpitSolution {
  readonly stemAngle: Degrees;
  /** Exactly what the frame demands, before any clamping. Drives the flags. */
  readonly spacerHeight: Millimeters;
  readonly stemLength: Millimeters;
}

/**
 * Solve for the spacer height and stem length that land the grip point exactly
 * on `target`, for one given stem angle.
 *
 * Returns null only if the determinant vanishes, which cannot happen for any
 * angle in (-90, 90) - the guard exists so a bad caller fails loudly rather
 * than producing infinities.
 */
export function solveForAngle(
  frame: FrameCore,
  target: BbPoint,
  stemAngle: Degrees,
  cockpit: ResolvedCockpit,
): CockpitSolution | null {
  const { dx, dy } = hoodOffset(cockpit);

  // Target, reduced to what the steerer rise and stem must supply.
  const a = target.x - frame.reach - dx;
  const b = target.y - frame.stack - dy;

  const hta = toRad(frame.headTubeAngle);
  const theta = toRad(deg(90 - frame.headTubeAngle + stemAngle));

  //   -cos(hta) * u + cos(theta) * L = a
  //    sin(hta) * u + sin(theta) * L = b
  const det = -Math.cos(toRad(stemAngle));
  if (Math.abs(det) < 1e-12) return null;

  const u = (a * Math.sin(theta) - b * Math.cos(theta)) / det;
  const stemLength = (-Math.cos(hta) * b - a * Math.sin(hta)) / det;

  return {
    stemAngle,
    spacerHeight: mm(u - cockpit.topCapHeight - cockpit.stemClampHeight / 2),
    stemLength: mm(stemLength),
  };
}

/** Every catalogue angle solved. Six exact evaluations, no iteration. */
export function solveAll(
  frame: FrameCore,
  target: BbPoint,
  cockpit: ResolvedCockpit,
  angles: ReadonlyArray<Degrees> = CATALOGUE_STEM_ANGLES,
): ReadonlyArray<CockpitSolution> {
  return angles
    .map((a) => solveForAngle(frame, target, a, cockpit))
    .filter((s): s is CockpitSolution => s !== null);
}

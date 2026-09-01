/**
 * Asymmetric fit tolerance around a reference frame's stack and reach.
 *
 * Short and long are not the same problem, and neither are low and high: a
 * frame that lands a little short in reach can be pulled back with a longer
 * stem, one that lands long often cannot. So "close enough" is four independent
 * numbers, not a radius - see the asymmetric-tolerance discussion in
 * product-spec.md.
 *
 * This is the ONE definition. The Matrix table's in-radius column and the
 * scatter plot's green zone both read the same {@link FitTolerance}, so moving
 * a slider can never change one without the other.
 */
export interface FitTolerance {
  /** How much SHORTER than the reference reach still counts as close (mm). */
  readonly xs: number;
  /** How much LONGER than the reference reach still counts as close (mm). */
  readonly xl: number;
  /** How much LOWER than the reference stack still counts as close (mm). */
  readonly yl: number;
  /** How much HIGHER than the reference stack still counts as close (mm). */
  readonly yh: number;
}

/** Defaults carried over from the reference tool. */
export const DEFAULT_FIT_TOLERANCE: FitTolerance = { xs: 12, xl: 8, yl: 15, yh: 10 };

/**
 * `deltaReach` / `deltaStack` are frame minus reference: negative reach is
 * shorter, negative stack is lower. Each side is checked against its own bound
 * and the bound is inclusive.
 */
export function withinFitRadius(
  deltaReach: number,
  deltaStack: number,
  tol: FitTolerance,
): boolean {
  const reachOk = deltaReach >= 0 ? deltaReach <= tol.xl : -deltaReach <= tol.xs;
  const stackOk = deltaStack >= 0 ? deltaStack <= tol.yh : -deltaStack <= tol.yl;
  return reachOk && stackOk;
}

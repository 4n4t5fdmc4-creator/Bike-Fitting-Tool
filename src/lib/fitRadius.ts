/**
 * Two independent bounds, not a circle. Reach and stack are felt differently
 * and tolerated differently, so a single "distance" number would hide which
 * axis actually blew the budget - see product-spec.md's asymmetric-tolerance
 * discussion.
 */
export function withinFitRadius(
  deltaReach: number,
  deltaStack: number,
  maxReach: number,
  maxStack: number,
): boolean {
  return Math.abs(deltaReach) <= maxReach && Math.abs(deltaStack) <= maxStack;
}

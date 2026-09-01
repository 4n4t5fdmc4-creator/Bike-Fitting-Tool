/**
 * A stack/reach anchor for the matrix comparison, when no reference frame is
 * on file.
 *
 * The matrix compares raw frame geometry (stack, reach) to a starting point -
 * a different axis from the grip-point target the ranking uses. With a
 * reference bike, the anchor is simply that bike's own stack and reach: real
 * numbers, nothing derived. Without one, there is no frame to read them from,
 * so this inverts the forward model for an assumed neutral cockpit and a
 * typical head tube angle to ask "what frame stack/reach would need an
 * ordinary build to reach the target?" - clearly an estimate, and labelled as
 * one everywhere it is shown.
 */

import type { BbPoint, Degrees } from '../domain/units';
import { deg, mm } from '../domain/units';
import { gripPoint } from './forward';
import { resolveCockpit } from './assumptions';

const ASSUMED_HTA: Degrees = deg(73);

export function virtualFrameStackReach(
  target: BbPoint,
  assumedHeadTubeAngle: Degrees = ASSUMED_HTA,
): { stack: number; reach: number } {
  const cockpit = resolveCockpit();
  // Offset a zero-size frame would contribute with this cockpit; subtracting
  // it from the target isolates what the frame itself must supply.
  const offset = gripPoint({ stack: mm(0), reach: mm(0), headTubeAngle: assumedHeadTubeAngle }, cockpit);
  return { reach: target.x - offset.x, stack: target.y - offset.y };
}

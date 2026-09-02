/**
 * Accufit-style configuration tables.
 *
 * Wilier's Accufit publishes, for every frame size, the distance from the
 * bottom bracket centre to the **handlebar centre** as an X/Y pair — one row
 * per buildable combination of size, spacer stack and stem, with neighbouring
 * rows about 2 mm apart. The point of that presentation is not the coordinate
 * but the discreteness: it lists only what can actually be bolted on, so a
 * fitter reads off a part number instead of a decimal.
 *
 * Our solver does the opposite — it inverts the forward model and returns
 * "stem 103.4 mm", which is not a thing anyone can order. This module closes
 * that gap: enumerate the combinations a shop can actually build, and report
 * how far each one misses the client's target.
 *
 * Two coordinates per row, deliberately:
 *  - `clamp` is the Accufit point itself (bar clamp centre), so a number here
 *    can be compared against a manufacturer's published Accufit table.
 *  - `hood` is where the hands land, which is what the fit was measured at and
 *    therefore what the ranking uses. Ranking on the clamp instead would let a
 *    bar with a different reach win on paper and lose on the road.
 */

import type { BbPoint } from '../domain/units';
import { deg, mm } from '../domain/units';
import { barClampPoint, gripPoint, type FrameCore, type ResolvedCockpit } from './forward';

/** A plain BB-relative pair. Not branded: these are outputs, not inputs. */
export interface AccufitPoint {
  readonly x: number;
  readonly y: number;
}

export interface AccufitOption {
  /** Stable key for React and for recording a decision. */
  readonly id: string;
  readonly stemLength: number;
  readonly stemAngle: number;
  readonly spacerHeight: number;
  /** The Accufit point: BB centre to handlebar clamp centre. */
  readonly clamp: AccufitPoint;
  /** Hood grip, BB-relative — where the hands actually end up. */
  readonly hood: AccufitPoint;
  /** hood − target, signed. Negative x is short, negative y is low. */
  readonly delta: AccufitPoint;
  /** Straight-line miss at the hoods, mm. The ranking key. */
  readonly miss: number;
}

/**
 * What the shop can fit. Defaults are the common road stock: 10 mm stem steps,
 * the four angles that are actually sold, and 5 mm spacers.
 */
export interface AccufitCatalogue {
  readonly stemLengths: ReadonlyArray<number>;
  readonly stemAngles: ReadonlyArray<number>;
  readonly spacerStep: number;
  readonly maxSpacer: number;
}

export const DEFAULT_CATALOGUE: AccufitCatalogue = {
  stemLengths: [80, 90, 100, 110, 120, 130],
  stemAngles: [-17, -6, 6, 17],
  spacerStep: 5,
  maxSpacer: 40,
};

/**
 * Within this many millimetres of the target, two builds are the same bike.
 * Accufit's own grid is 2 mm; below that the fit is decided by saddle position
 * and shoe stack, not by the stem.
 */
export const ACCUFIT_TOLERANCE_MM = 2;

/**
 * Every buildable cockpit for one frame, best first.
 *
 * `base` supplies the bar and the assumption set — the client's own handlebar
 * travels with them across frames, so it is held fixed while stem and spacers
 * vary. The frame's own spacer limit caps the stack; a frame that cannot take
 * 40 mm never offers a row that needs it.
 */
export function accufitOptions(
  frame: FrameCore,
  base: ResolvedCockpit,
  target: BbPoint,
  catalogue: Partial<AccufitCatalogue> = {},
): ReadonlyArray<AccufitOption> {
  const cat: AccufitCatalogue = { ...DEFAULT_CATALOGUE, ...catalogue };
  const out: AccufitOption[] = [];

  const spacers: number[] = [];
  for (let h = 0; h <= cat.maxSpacer + 1e-9; h += cat.spacerStep) spacers.push(h);

  for (const stemLength of cat.stemLengths) {
    for (const stemAngle of cat.stemAngles) {
      for (const spacerHeight of spacers) {
        const cockpit: ResolvedCockpit = {
          ...base,
          stemLength: mm(stemLength),
          stemAngle: deg(stemAngle),
          spacerHeight: mm(spacerHeight),
        };
        const clamp = barClampPoint(frame, cockpit);
        const hood = gripPoint(frame, cockpit);
        const dx = hood.x - target.x;
        const dy = hood.y - target.y;
        out.push({
          id: `${stemLength}/${stemAngle}/${spacerHeight}`,
          stemLength,
          stemAngle,
          spacerHeight,
          clamp: { x: clamp.x, y: clamp.y },
          hood: { x: hood.x, y: hood.y },
          delta: { x: dx, y: dy },
          miss: Math.hypot(dx, dy),
        });
      }
    }
  }

  // Ties broken towards the plainer build: fewer spacers, then a shorter stem.
  // Two rows that land in the same millimetre are the same fit, so the one that
  // looks like a stock bike should win.
  return out.sort(
    (a, b) =>
      a.miss - b.miss ||
      a.spacerHeight - b.spacerHeight ||
      a.stemLength - b.stemLength,
  );
}

/**
 * The best buildable option per frame, for ranking whole frames against each
 * other. A frame whose best row still misses by 15 mm cannot be built to this
 * client, however good its raw stack and reach look.
 */
export function bestAccufit(
  frame: FrameCore,
  base: ResolvedCockpit,
  target: BbPoint,
  catalogue: Partial<AccufitCatalogue> = {},
): AccufitOption | null {
  return accufitOptions(frame, base, target, catalogue)[0] ?? null;
}

/** How to read a row: "spot on", or which way it is off and by how much. */
export function describeMiss(o: AccufitOption): string {
  if (o.miss <= ACCUFIT_TOLERANCE_MM) return 'on target';
  const parts: string[] = [];
  if (Math.abs(o.delta.x) >= 1) {
    parts.push(`${Math.abs(o.delta.x).toFixed(0)} mm ${o.delta.x > 0 ? 'long' : 'short'}`);
  }
  if (Math.abs(o.delta.y) >= 1) {
    parts.push(`${Math.abs(o.delta.y).toFixed(0)} mm ${o.delta.y > 0 ? 'high' : 'low'}`);
  }
  return parts.join(', ') || 'on target';
}

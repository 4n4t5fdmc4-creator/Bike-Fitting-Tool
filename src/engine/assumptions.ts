/**
 * Turns the documented default assumptions into a concrete cockpit the forward
 * model can use. Resolution happens exactly once, here, so no downstream module
 * ever has to guess a missing value.
 */

import type { Degrees, Millimeters } from '../domain/units.js';
import { deg, mm } from '../domain/units.js';
import { DEFAULT_ASSUMPTIONS } from '../domain/validation.js';
import type { ResolvedCockpit } from './forward.js';

/** Physical limits on what can actually be built. */
export interface CockpitLimits {
  readonly stemMin: Millimeters;
  readonly stemMax: Millimeters;
  readonly spacerMin: Millimeters;
  readonly spacerMax: Millimeters;
  /** Stem lengths a shop stocks. Solutions snap to these. */
  readonly stemLengths: ReadonlyArray<Millimeters>;
}

export const DEFAULT_LIMITS: CockpitLimits = {
  stemMin: mm(70),
  stemMax: mm(130),
  spacerMin: mm(0),
  spacerMax: mm(40),
  stemLengths: [60, 70, 80, 90, 100, 110, 120, 130, 140].map(mm),
};

/** A cockpit built from the documented defaults, with overrides applied. */
export function resolveCockpit(over: Partial<ResolvedCockpit> = {}): ResolvedCockpit {
  const a = DEFAULT_ASSUMPTIONS;
  return {
    spacerHeight: mm(20),
    stemLength: mm(100),
    stemAngle: deg(-6),
    topCapHeight: a.topCapHeight.value,
    stemClampHeight: a.stemClampHeight.value,
    barReach: a.barReach.value,
    barRise: mm(0),
    barRotation: a.barRotation.value,
    hoodForward: a.hoodForward.value,
    hoodRise: a.hoodRise.value,
    ...over,
  };
}

/** Nearest catalogue stem length. */
export function snapStem(
  length: number,
  lengths: ReadonlyArray<Millimeters> = DEFAULT_LIMITS.stemLengths,
): Millimeters {
  let best = lengths[0] ?? mm(100);
  for (const l of lengths) {
    if (Math.abs(l - length) < Math.abs(best - length)) best = l;
  }
  return best;
}

export const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

export type { Degrees, Millimeters };

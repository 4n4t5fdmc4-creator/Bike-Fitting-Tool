/**
 * Delta attribution: which geometry property caused the difference?
 *
 * One-at-a-time substitution. Hold the reference frame constant, swap in a
 * single property from the candidate, and record how far the grip point moved.
 * Interaction effects are reported as a residual rather than smeared across the
 * terms, because a term that silently absorbs interactions is not an attribution.
 */

import type { Millimeters } from '../domain/units.js';
import { mm } from '../domain/units.js';
import type { FrameCore, ResolvedCockpit } from './forward.js';
import { gripPoint } from './forward.js';

export type AttributableProperty = 'stack' | 'reach' | 'headTubeAngle';

export interface AttributionTerm {
  readonly property: AttributableProperty;
  readonly deltaX: Millimeters;
  readonly deltaY: Millimeters;
  readonly from: number;
  readonly to: number;
}

export interface Attribution {
  readonly totalDeltaX: Millimeters;
  readonly totalDeltaY: Millimeters;
  /** Sorted by magnitude, largest first. */
  readonly terms: ReadonlyArray<AttributionTerm>;
  readonly residual: { readonly x: Millimeters; readonly y: Millimeters };
}

const PROPERTIES: ReadonlyArray<AttributableProperty> = ['reach', 'stack', 'headTubeAngle'];

export function attribute(
  reference: FrameCore,
  candidate: FrameCore,
  cockpit: ResolvedCockpit,
): Attribution {
  const base = gripPoint(reference, cockpit);
  const full = gripPoint(candidate, cockpit);

  const terms = PROPERTIES.map((property): AttributionTerm => {
    const swapped = { ...reference, [property]: candidate[property] } as FrameCore;
    const moved = gripPoint(swapped, cockpit);
    return {
      property,
      deltaX: mm(moved.x - base.x),
      deltaY: mm(moved.y - base.y),
      from: reference[property],
      to: candidate[property],
    };
  }).sort((a, b) => Math.hypot(b.deltaX, b.deltaY) - Math.hypot(a.deltaX, a.deltaY));

  const sumX = terms.reduce((s, t) => s + t.deltaX, 0);
  const sumY = terms.reduce((s, t) => s + t.deltaY, 0);

  return {
    totalDeltaX: mm(full.x - base.x),
    totalDeltaY: mm(full.y - base.y),
    terms,
    residual: { x: mm(full.x - base.x - sumX), y: mm(full.y - base.y - sumY) },
  };
}

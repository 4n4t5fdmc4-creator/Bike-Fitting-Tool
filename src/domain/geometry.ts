/**
 * Frame geometry.
 *
 * Two design points worth stating up front:
 *
 * 1. `stack` and `reach` are required; everything else is optional. Those two
 *    plus the two angles are enough for a provisional score, and demanding a
 *    complete table would make most real frames unusable.
 *
 * 2. Seat tube angle is a discriminated union, not a number. Manufacturers
 *    publish *effective* seat angle - the angle to a reference saddle position,
 *    not the angle of the tube. For a tall rider on a long extension the two
 *    differ by up to 1.5 degrees, which is 20 mm of saddle setback. Forcing the
 *    caller to say which one they have makes that impossible to ignore.
 */

import type { Degrees, Millimeters, Ratio, Sourced } from './units.js';
import type { CockpitSetup } from './components.js';
import type { ContactPoints } from './fit.js';

/**
 * Seat tube angle. The distinction matters enough to encode in the type.
 *
 * `effective` is what geometry tables publish. Converting it to an actual angle
 * requires knowing the saddle height it was quoted at, which manufacturers
 * rarely state - hence the optional field and the reduced confidence it implies.
 */
export type SeatTubeAngle =
  | { readonly kind: 'actual'; readonly angle: Degrees }
  | {
      readonly kind: 'effective';
      readonly angle: Degrees;
      /** Saddle height the figure was quoted at, when known. */
      readonly quotedAtSaddleHeight?: Millimeters;
    };

/** How a geometry entry was obtained. Drives trust and traceability. */
export interface GeometrySource {
  readonly kind: 'curated' | 'imported' | 'manual';
  /** Manufacturer page the values came from, for `imported`. */
  readonly url?: string;
  readonly retrievedAt?: string;
  /** Free text where a manufacturer's measuring convention is known to differ. */
  readonly conventionNote?: string;
}

/**
 * The geometry of one frame in one size.
 *
 * REQUIRED: stack, reach, headTubeAngle, seatTubeAngle.
 * Everything else is optional and has a documented fallback in `assumptions.ts`.
 */
export interface FrameGeometry {
  readonly stack: Millimeters;
  readonly reach: Millimeters;
  readonly headTubeAngle: Degrees;
  readonly seatTubeAngle: SeatTubeAngle;

  /** Needed to place the fork and to compute standover on sloping frames. */
  readonly headTubeLength?: Millimeters;
  /** Centre to top. Bounds seatpost extension. */
  readonly seatTubeLength?: Millimeters;
  readonly effectiveTopTube?: Millimeters;

  readonly chainstayLength?: Millimeters;
  readonly wheelbase?: Millimeters;
  readonly bbDrop?: Millimeters;
  readonly forkRake?: Millimeters;
  /** Axle to crown. Required for an exact front-axle position; usually absent. */
  readonly forkAxleToCrown?: Millimeters;

  readonly standover?: Millimeters;
  /** Front axle to BB, horizontal. Derived when absent, needed for toe overlap. */
  readonly frontCentre?: Millimeters;

  /**
   * Largest steerer spacer stack the manufacturer permits. Frame-specific and
   * frequently ignored; exceeding it is a structural issue on carbon steerers.
   */
  readonly maxSpacerStack?: Millimeters;

  readonly wheelRadius?: Millimeters;
}

/** One purchasable size of a model. */
export interface FrameSize {
  readonly id: string;
  /** As the manufacturer labels it: "54", "M", "ML". */
  readonly label: string;
  readonly geometry: FrameGeometry;
  /** Cockpit the bike ships with. Drives the "cheapest change" solution. */
  readonly stockCockpit?: StockCockpitSpec;
  /** Rider height range the manufacturer claims. Advisory only, never scored. */
  readonly manufacturerHeightRange?: { readonly min: Millimeters; readonly max: Millimeters };
}

/** What the bike comes with out of the box, where known. */
export interface StockCockpitSpec {
  readonly stemLength?: Millimeters;
  readonly stemAngle?: Degrees;
  readonly spacerStack?: Millimeters;
  readonly handlebarId?: string;
  readonly seatpostSetback?: Millimeters;
  readonly crankLength?: Millimeters;
}

/**
 * Whether the cockpit can be changed at all. On an increasing share of premium
 * bikes it cannot, which collapses the optimisation space to whatever the
 * manufacturer sells. Modelled as a union so the optimiser cannot forget.
 */
export type CockpitType =
  /** Conventional round steerer: any stem, any bar, free spacer stack. */
  | { readonly kind: 'conventional' }
  /**
   * One-piece or proprietary cockpit. Only the listed part numbers fit, and
   * spacer changes may be restricted or impossible.
   */
  | {
      readonly kind: 'integrated';
      readonly availableCockpitIds: ReadonlyArray<string>;
      readonly spacerAdjustable: boolean;
      readonly maxSpacerStack?: Millimeters;
    };

export type BikeCategory = 'road' | 'endurance' | 'gravel' | 'cyclocross' | 'tt' | 'mtb';

/** A model, across all its sizes. */
export interface BikeModel {
  readonly id: string;
  readonly brand: string;
  readonly model: string;
  readonly year?: number;
  readonly category: BikeCategory;
  readonly cockpit: CockpitType;
  readonly sizes: ReadonlyArray<FrameSize>;
  readonly source: GeometrySource;
}

/** Values computed from a geometry rather than published with it. */
export interface DerivedGeometry {
  readonly stackToReach: Ratio;
  readonly trail: Millimeters;
  readonly frontCentre: Millimeters;
  /** True when the toe can strike the front wheel at full lock. */
  readonly toeOverlap?: { readonly present: boolean; readonly clearance: Millimeters };
}

/** A bike the rider owns, as actually configured. */
export interface CurrentBike {
  readonly id: string;
  readonly label: string;
  readonly modelId?: string;
  readonly geometry: Sourced<FrameGeometry>;
  readonly setup: CockpitSetup;
  /**
   * Measured contact points, when the rider measured them directly rather than
   * letting the model compute them. Always preferred over computed values -
   * a measurement beats a derivation of the same quantity.
   */
  readonly measuredContactPoints?: ContactPoints;
  readonly ridesWell?: boolean;
}

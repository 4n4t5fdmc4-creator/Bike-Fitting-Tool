/**
 * Component library and cockpit setup.
 *
 * The library exists because "what stem do I need" is only answerable against a
 * catalogue of stems that exist. An optimiser that returns a 103 mm stem has
 * produced arithmetic, not advice.
 */

import type { Degrees, Grams, Millimeters, Sourced } from './units.js';

// --- Stem ------------------------------------------------------------------

/**
 * Stem angle convention: measured relative to the **perpendicular of the
 * steering axis**, which is how manufacturers label them.
 *
 * Consequence riders find surprising, and the UI must explain: on a 73 degree
 * head angle a -17 degree stem sits exactly horizontal, while a -6 degree stem
 * still rises 11 degrees. `angleAboveHorizontal = 90 - headTubeAngle + stemAngle`.
 */
export interface Stem {
  readonly id: string;
  readonly brand?: string;
  readonly model?: string;
  /** Centre of steerer clamp to centre of bar clamp. 50-150 mm in practice. */
  readonly length: Millimeters;
  /** Signed, per the convention above. Catalogue values: -17, -12, -6, 0, +6, +17. */
  readonly angle: Degrees;
  /** Can it be mounted rotated 180 degrees? Doubles the usable angle range. */
  readonly flippable: boolean;
  /** Height of the steerer clamp. Adds to the effective spacer stack. */
  readonly clampHeight: Millimeters;
  readonly weight?: Grams;
  /** Only fits the listed frames. Set for proprietary and integrated cockpits. */
  readonly proprietaryFor?: ReadonlyArray<string>;
}

// --- Handlebar -------------------------------------------------------------

export type HandlebarKind = 'drop' | 'flat' | 'riser' | 'aero';

/**
 * Handlebar geometry.
 *
 * The bar moves the rider's hands 20-40 mm relative to the stem clamp - more
 * than a frame size step - so it is modelled explicitly rather than folded into
 * a constant.
 */
export interface Handlebar {
  readonly id: string;
  readonly brand?: string;
  readonly model?: string;
  readonly kind: HandlebarKind;

  /** Centre-to-centre at the hoods, or grip centre for flat bars. */
  readonly width: Millimeters;
  /** Bar clamp centre to the forward-most point of the bend. Drop bars: 70-100 mm. */
  readonly reach: Millimeters;
  /** Vertical tops to drops. Drop bars: 120-145 mm. Zero for flat bars. */
  readonly drop: Millimeters;
  /** Grip area above the clamp. Zero for drop bars, 15-40 mm for risers. */
  readonly rise: Millimeters;
  /** Rearward sweep of the grip area. Flat and gravel bars only. */
  readonly backsweep?: Degrees;
  /** Outward flare of the drops. Gravel bars: 10-25 degrees. */
  readonly flare?: Degrees;
  readonly weight?: Grams;
}

/**
 * Brake lever generation. Where the hood grip sits relative to the bar's
 * forward extent, which differs enough between generations to absorb a full
 * stem-length step.
 */
export interface LeverGeneration {
  readonly id: string;
  readonly label: string;
  /** Forward of the bar's forward-most bend point to the hood grip centre. */
  readonly hoodForward: Millimeters;
  /** Hood grip centre above the bar clamp centreline. */
  readonly hoodRise: Millimeters;
  /** Reach-adjust travel, where the lever offers it. Shifts `hoodForward`. */
  readonly reachAdjustRange?: Millimeters;
}

// --- Seatpost and saddle ---------------------------------------------------

export interface Seatpost {
  readonly id: string;
  readonly brand?: string;
  readonly model?: string;
  /** Rail clamp behind the post axis. Catalogue values: 0, 15, 20, 25 mm. */
  readonly setback: Millimeters;
  readonly length: Millimeters;
  /** Marked minimum insertion depth. A hard safety limit, not a guideline. */
  readonly minInsertion: Millimeters;
  /** Rail travel available at the clamp, each way from centre. Typically 25-30 mm. */
  readonly railTravel: Millimeters;
  readonly weight?: Grams;
}

/**
 * Saddle.
 *
 * `widthPointOffset` is the load-bearing field. The fit reference is the point
 * at which the saddle measures 70 mm wide - not the nose, which moved 25-30 mm
 * when short-nose saddles arrived and is therefore not transferable between
 * models. This value is measured once per saddle and stored.
 */
export interface Saddle {
  readonly id: string;
  readonly brand?: string;
  readonly model?: string;
  readonly length: Millimeters;
  readonly width: Millimeters;
  /**
   * Horizontal distance from the rail clamp centre to the 70 mm width point,
   * positive forwards. 45-70 mm for short-nose models, 70-95 mm for classic.
   */
  readonly widthPointOffset: Sourced<Millimeters>;
  /** Rail top to saddle top surface at the reference point. ~35 mm typical. */
  readonly railToTopHeight: Millimeters;
  readonly weight?: Grams;
}

// --- Spacers ---------------------------------------------------------------

/**
 * Steerer spacers are modelled as a total height rather than a list of parts.
 * Riders think in "10 mm more"; nobody optimises the arrangement.
 */
export interface SpacerStack {
  /** Total spacer height below the stem. */
  readonly height: Millimeters;
  /** Headset top cap and compression ring. Adds to the stack. ~5-15 mm. */
  readonly topCapHeight: Millimeters;
}

// --- Cockpit setup ---------------------------------------------------------

/** Complete component configuration on one bike. */
export interface CockpitSetup {
  readonly stem: Stem;
  /** Mounted rotated 180 degrees, inverting the sign of the stem angle. */
  readonly stemFlipped: boolean;
  readonly spacers: SpacerStack;
  readonly handlebar: Handlebar;
  /** Bar rotation in the clamp, from the neutral position. Positive = drops down. */
  readonly barRotation: Degrees;
  readonly levers: LeverGeneration;
  readonly seatpost: Seatpost;
  readonly saddle: Saddle;
  /** Rail offset from centre, positive forwards. Bounded by `seatpost.railTravel`. */
  readonly railOffset: Millimeters;
  /** Saddle height, BB to top along the seat axis. */
  readonly saddleHeight: Millimeters;
  readonly crankLength: Millimeters;
}

/** Everything the optimiser is allowed to select from. */
export interface ComponentLibrary {
  readonly stems: ReadonlyArray<Stem>;
  readonly handlebars: ReadonlyArray<Handlebar>;
  readonly seatposts: ReadonlyArray<Seatpost>;
  readonly saddles: ReadonlyArray<Saddle>;
  readonly levers: ReadonlyArray<LeverGeneration>;
  /** Spacer heights that can actually be assembled. Usually 2.5 mm increments. */
  readonly spacerIncrements: ReadonlyArray<Millimeters>;
}

/**
 * What the rider is willing to change. Drives the three solution flavours in
 * the Optimization tab: keep everything, swap the cheap parts, or buy what fits.
 */
export interface ChangeBudget {
  readonly canChangeStem: boolean;
  readonly canChangeSpacers: boolean;
  readonly canChangeHandlebar: boolean;
  readonly canChangeSeatpost: boolean;
  readonly canChangeSaddle: boolean;
  /** Components the rider already owns and would rather reuse. */
  readonly ownedComponentIds?: ReadonlyArray<string>;
}

/**
 * The rider: body measurements, flexibility, riding style, and the fit profile
 * derived from them.
 *
 * TIERING
 * -------
 * Tier 1 fields are required - nothing can be computed without them.
 * Tier 2 fields are optional but each one materially narrows the target
 * envelope. The UI advertises what each is worth (see spec §6.2); the type
 * system simply marks them optional.
 */

import type { Degrees, Millimeters, Provenance, Sourced } from './units.js';

// --- Body ------------------------------------------------------------------

/**
 * Required body measurements. All lengths in millimetres after boundary
 * conversion - riders enter centimetres.
 */
export interface RequiredBodyMeasurements {
  /** Barefoot standing height. 1400-2100 mm. */
  readonly height: Sourced<Millimeters>;
  /**
   * Inseam, measured floor to crotch with a book pulled up firmly - not the
   * trouser inseam, which is 20-40 mm shorter and the most common input error
   * in the whole model.
   */
  readonly inseam: Sourced<Millimeters>;
}

/**
 * Optional body measurements. Each is independently optional: a rider who
 * measures only torso still gets a better result than one who measures none.
 */
export interface OptionalBodyMeasurements {
  /** C7 vertebra to the top of the saddle, seated upright. Separates reach from height. */
  readonly torso?: Sourced<Millimeters>;
  /** Acromion to the centre of a closed fist. Drives bar reach. */
  readonly arm?: Sourced<Millimeters>;
  /** Bi-acromial width. Handlebar width recommendation (V2). */
  readonly shoulderWidth?: Sourced<Millimeters>;
  /** Sit bone width, measured on a memory-foam pad. Saddle width, and the 70 mm reference. */
  readonly sitBoneWidth?: Sourced<Millimeters>;
  /** Sole length. Needed for toe-overlap detection only. */
  readonly footLength?: Sourced<Millimeters>;
}

export type BodyMeasurements = RequiredBodyMeasurements & OptionalBodyMeasurements;

// --- Flexibility and style -------------------------------------------------

/**
 * Self-assessed hamstring and lower-back flexibility, from a sit-and-reach
 * style test described in the UI.
 *
 * This is the primary determinant of tolerable bar drop, and it is the reason
 * two riders with identical body measurements get different targets.
 */
export type FlexibilityLevel = 'limited' | 'average' | 'good' | 'excellent';

/** Intended use. Shifts both reach and drop targets. */
export type RidingStyle = 'comfort' | 'allround' | 'performance';

/**
 * Conditions that bias the target towards a more upright position regardless
 * of what the formulas produce. Advisory, never diagnostic.
 */
export interface RiderConstraints {
  /** Recurring lower-back, neck, hand or knee complaints. */
  readonly discomfort?: ReadonlyArray<'lowerBack' | 'neck' | 'hands' | 'knees' | 'saddle'>;
  /** Years. Used only to soften drop targets above ~55. */
  readonly age?: number;
  /** Rider has had a professional bike fit; treat their current position as authoritative. */
  readonly professionallyFitted?: boolean;
}

// --- Profile ---------------------------------------------------------------

export interface RiderProfile {
  readonly id: string;
  readonly label: string;
  readonly body: BodyMeasurements;
  readonly flexibility: FlexibilityLevel;
  readonly style: RidingStyle;
  readonly constraints?: RiderConstraints;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// --- Ideal fit profile -----------------------------------------------------

/**
 * How the target position was arrived at. This is a discriminated union rather
 * than a flag because the three origins carry genuinely different confidence
 * and different downstream messaging.
 */
export type FitProfileOrigin =
  /** Measured off a bike the rider already rides well. Highest confidence. */
  | { readonly kind: 'fromCurrentBike'; readonly bikeId: string }
  /** Computed from body measurements, flexibility and style. Wide bands. */
  | { readonly kind: 'derived'; readonly formulaVersion: string }
  /** Entered directly, typically by a fitter with client data. Trusted as given. */
  | { readonly kind: 'manual'; readonly enteredBy?: string };

/**
 * The rider's target position, expressed in the quantities a fitter actually
 * works with. Converted to absolute contact points per candidate bike, because
 * saddle setback depends on the frame's seat angle.
 *
 * Every field is a range, not a point. A target that claims millimetre
 * precision it does not have is the failure mode this type exists to prevent.
 */
export interface IdealFitProfile {
  readonly origin: FitProfileOrigin;

  /**
   * PRIMARY AXIS. Horizontal BB to hood grip centre.
   *
   * Grip reach and grip stack are the quantities the frame plus its cockpit
   * actually produce, and the ones the rider feels. Frame stack and reach remain
   * the shopping vocabulary, but the target is expressed here.
   */
  readonly gripReach: TargetRange;
  /** PRIMARY AXIS. Vertical BB to hood grip centre. */
  readonly gripStack: TargetRange;

  /**
   * Saddle target. A CONSTRAINT, not a scoring axis: seatpost setback comes in
   * four catalogue values and rails give +-25-30 mm, so a saddle position that
   * cannot be met is a gate, and one near the rail limit is a minor penalty.
   * Getting the bars right is the frame decision; the saddle is an afternoon.
   */
  readonly saddleHeight: Sourced<Millimeters>;
  /** Horizontal BB to the 70 mm saddle-width point. Positive = behind the BB. */
  readonly saddleSetback: Sourced<Millimeters>;

  /** Crank length. Affects the target only indirectly, via saddle height. */
  readonly crankLength?: Sourced<Millimeters>;

  /**
   * Set when the rider has been told, or has decided, that their position
   * should change from what they currently ride. Overrides the derived value.
   */
  readonly intentionalChange?: string;
}

/**
 * A target expressed as an ideal with a tolerance band.
 *
 * `ideal` is what scoring aims at; `min`/`max` bound what is acceptable. The
 * band widens automatically as input provenance degrades.
 */
export interface TargetRange {
  readonly ideal: Millimeters;
  readonly min: Millimeters;
  readonly max: Millimeters;
  readonly provenance: Provenance;
}

/** Style and flexibility coefficients used by the derivation formulas. */
export interface FitDerivationCoefficients {
  /** Multiplier on inseam for saddle height. LeMond's 0.883 is the baseline. */
  readonly saddleHeightFactor: number;
  /** Multiplier on height for hood reach. */
  readonly hoodReachFactor: number;
  /** Base hood drop in mm at 1780 mm rider height, before flexibility adjustment. */
  readonly hoodDropBase: Millimeters;
  /** Added to hood drop, per flexibility level above `average`. */
  readonly dropPerFlexibilityStep: Millimeters;
  /** Seat tube angle assumed when converting saddle height to setback. */
  readonly referenceSeatAngle: Degrees;
}

/**
 * Contact points, candidate setups, and the assumptions that connect a
 * component list to a position.
 */

import type { Millimeters, BbPoint, Sourced, Degrees } from './units';
import type { CockpitSetup, ChangeBudget, ComponentLibrary } from './components';
import type { FrameGeometry, FrameSize, BikeModel } from './geometry';
import type { IdealFitProfile, TargetRange } from './rider';

/**
 * Where the rider actually touches the bike, in BB-relative coordinates.
 *
 * This is the model's central value type. Two bikes producing identical contact
 * points feel identical, whatever their geometry tables say.
 */
export interface ContactPoints {
  /** The 70 mm saddle-width point, on the top surface. */
  readonly saddle: BbPoint;
  /** Centre of the handlebar at the stem clamp. */
  readonly barClamp: BbPoint;
  /** Hood grip centre. The dominant hand position on a drop bar. */
  readonly hoods: BbPoint;
  /** Grip centre in the drops. Absent for flat and riser bars. */
  readonly drops?: BbPoint;
  /** Grip centre on the tops, or the only grip position on a flat bar. */
  readonly tops: BbPoint;
  /** Pedal spindle circle radius. The BB itself is the origin. */
  readonly crankLength: Millimeters;
}

/** The fitter-facing quantities derived from a set of contact points. */
export interface FitMetrics {
  /** PRIMARY. Horizontal BB to hood grip centre. */
  readonly gripReach: Millimeters;
  /** PRIMARY. Vertical BB to hood grip centre. */
  readonly gripStack: Millimeters;

  readonly saddleHeight: Millimeters;
  /** Positive = saddle reference point behind the BB. */
  readonly saddleSetback: Millimeters;
  /** Horizontal saddle reference point to hood grip. Secondary, for fitters. */
  readonly hoodReach: Millimeters;
  /** Saddle top above hood grip. Secondary, for fitters. */
  readonly hoodDrop: Millimeters;
  /** Frame stack over frame reach. Kept because it is the shopping vocabulary. */
  readonly stackToReach: number;
}

/**
 * One frame size configured with one component set - the unit the scorer
 * consumes and the optimiser produces.
 */
export interface CandidateSetup {
  readonly id: string;
  readonly model: BikeModel;
  readonly size: FrameSize;
  readonly setup: CockpitSetup;
  readonly contactPoints: ContactPoints;
  readonly metrics: FitMetrics;
  /** Parts that differ from the bike's stock specification. */
  readonly changesFromStock: ReadonlyArray<ComponentChange>;
}

export interface ComponentChange {
  readonly part: 'stem' | 'spacers' | 'handlebar' | 'seatpost' | 'saddle';
  readonly from: string;
  readonly to: string;
  readonly reason: string;
}

/**
 * The rider's target, resolved against one specific frame.
 *
 * Absolute coordinates cannot live on `IdealFitProfile`, because saddle setback
 * depends on the frame's seat tube angle. The profile holds intent; this holds
 * the intent applied to a frame.
 */
export interface TargetContactPoints {
  readonly profile: IdealFitProfile;
  readonly frame: FrameGeometry;
  /** PRIMARY target: BB-relative grip point the scorer aims at. */
  readonly grip: BbPoint;
  readonly gripReach: TargetRange;
  readonly gripStack: TargetRange;
  /** Half-width and half-height of the acceptable box around `grip`. */
  readonly tolerance: { readonly x: Millimeters; readonly y: Millimeters };
  /**
   * Saddle target resolved against this frame's seat angle. Checked for
   * feasibility only - it never contributes to the score.
   */
  readonly saddle: BbPoint;
}

/**
 * Input to the optimiser: a frame, a target, a parts catalogue, and the limits
 * on what may change.
 */
export interface OptimizationRequest {
  readonly size: FrameSize;
  readonly model: BikeModel;
  readonly target: TargetContactPoints;
  readonly library: ComponentLibrary;
  readonly budget: ChangeBudget;
  /** Retained where the rider wants to reuse what is already on the bike. */
  readonly currentSetup?: CockpitSetup;
}

/** What the optimiser is asked to prioritise. */
export type OptimizationGoal = 'closestFit' | 'cheapestChange' | 'reuseParts';

export interface OptimizationResult {
  readonly goal: OptimizationGoal;
  readonly setup: CandidateSetup;
  /**
   * Signed residual after clamping to buildable components. Zero for most
   * frames - three cockpit degrees of freedom against a two-dimensional target
   * means the grip point is usually reachable exactly. See docs/scoring-engine.md
   * section 3: this is why the score is dominated by how extreme the required
   * cockpit is, not by how close the result lands.
   */
  readonly residual: { readonly reach: Millimeters; readonly stack: Millimeters };
  /** Adjustments sitting against a hard limit, with the limit named. */
  readonly atLimit: ReadonlyArray<{ readonly what: string; readonly limit: string }>;
}

/**
 * Documented constants. Every one of these is an assumption that will be wrong
 * for some rider, so each is overridable, carries a range, and is surfaced in
 * the UI rather than buried.
 */
export interface FitAssumptions {
  /**
   * HOOD POSITION.
   * Hood grip sits forward of the bar's forward-most bend and above the clamp
   * centreline. Values are per lever generation; these are the fallbacks used
   * when the rider does not identify their levers.
   *
   * Modern hydraulic levers (2019+) sit ~35 mm forward and ~20 mm up. Mechanical
   * levers of the 2010s sit ~25 mm forward and ~10 mm up. Using the modern
   * figure on an older bike overstates reach by about 10 mm.
   */
  readonly hoodForward: Sourced<Millimeters>;
  readonly hoodRise: Sourced<Millimeters>;

  /**
   * BAR REACH.
   * Assumed when the handlebar model is unknown. 80 mm is the modern compact
   * median; classic bars run to 100 mm. The error range is a full stem step, so
   * this assumption is flagged whenever it is used.
   */
  readonly barReach: Sourced<Millimeters>;
  readonly barDrop: Sourced<Millimeters>;
  readonly barRotation: Sourced<Degrees>;

  /**
   * SPACER STACK.
   * `topCapHeight` covers the headset top cap and compression ring, which are
   * part of the stack but are never counted by riders reporting "20 mm of
   * spacers". Default 10 mm.
   *
   * `maxSpacerStack` is the fallback ceiling when the frame does not state one.
   * 40 mm is the common carbon-steerer limit; exceeding it is a structural
   * question, not a fit question, so the model refuses rather than extrapolates.
   */
  readonly topCapHeight: Sourced<Millimeters>;
  readonly maxSpacerStack: Sourced<Millimeters>;
  readonly stemClampHeight: Sourced<Millimeters>;

  /** Saddle 70 mm width point offset, when the saddle model is unknown. */
  readonly saddleWidthPointOffset: Sourced<Millimeters>;
  readonly saddleRailToTop: Sourced<Millimeters>;

  /** Wheel radius including tyre, when not derivable from the build. */
  readonly wheelRadius: Sourced<Millimeters>;
}

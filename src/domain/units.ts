/**
 * Units, coordinates and data provenance.
 *
 * NORMALISATION RULE
 * ------------------
 * Every length inside the domain is **millimetres**. Every angle is **degrees**.
 * Nothing else exists past the input boundary. Riders speak centimetres and
 * occasionally inches; geometry tables mix millimetres and centimetres in the
 * same row. All of that is converted once, at the edge, by the helpers below.
 *
 * Units are branded so the compiler refuses to add a length to an angle or to
 * pass a raw `number` where a measured quantity is expected. This is the single
 * highest-value type decision in the model: unit confusion is the dominant
 * silent-failure mode in fit calculations.
 */

/** Millimetres. The only length unit inside the domain. */
export type Millimeters = number & { readonly __unit: 'mm' };

/** Degrees. The only angle unit inside the domain. */
export type Degrees = number & { readonly __unit: 'deg' };

/** Grams. Used only for component weight, never for fit. */
export type Grams = number & { readonly __unit: 'g' };

/** A dimensionless ratio, e.g. stack/reach. */
export type Ratio = number & { readonly __unit: 'ratio' };

/** 0-100. Scores never leave this range. */
export type Score = number & { readonly __unit: 'score' };

// --- Constructors (the only sanctioned way into a branded type) -------------

export const mm = (n: number): Millimeters => n as Millimeters;
export const deg = (n: number): Degrees => n as Degrees;
export const grams = (n: number): Grams => n as Grams;
export const ratio = (n: number): Ratio => n as Ratio;
export const score = (n: number): Score =>
  Math.max(0, Math.min(100, n)) as Score;

// --- Boundary conversions --------------------------------------------------

/** Centimetres to millimetres. Riders give height and inseam in cm. */
export const fromCm = (n: number): Millimeters => (n * 10) as Millimeters;

/** Inches to millimetres. Some US geometry tables and all tyre sizes. */
export const fromInch = (n: number): Millimeters => (n * 25.4) as Millimeters;

export const toCm = (n: Millimeters): number => n / 10;
export const toRad = (d: Degrees): number => (d * Math.PI) / 180;
export const toDeg = (r: number): Degrees => ((r * 180) / Math.PI) as Degrees;

// --- Coordinates -----------------------------------------------------------

/**
 * A point in the bike's sagittal plane, **relative to the bottom bracket**.
 *
 *   +x = horizontal, towards the front wheel
 *   +y = vertical, up
 *
 * The BB is the origin for every position in this model. There is deliberately
 * no second coordinate space: a point that is not BB-relative is not a point.
 */
export interface BbPoint {
  readonly x: Millimeters;
  readonly y: Millimeters;
}

export const point = (x: number, y: number): BbPoint => ({ x: mm(x), y: mm(y) });

// --- Provenance ------------------------------------------------------------

/**
 * Where a value came from. This drives the confidence band on every output, so
 * it is carried on the value itself rather than tracked alongside it.
 *
 * Ordered from most to least trustworthy.
 */
export type Provenance =
  /** Physically measured by the rider or a fitter. */
  | 'measured'
  /** Read from the curated geometry database. */
  | 'database'
  /** Parsed from a manufacturer page and confirmed by the rider. */
  | 'imported'
  /** Computed from other values the rider supplied. */
  | 'derived'
  /** Inferred from population statistics, e.g. torso from height. */
  | 'estimated'
  /** A documented constant used because nothing better was available. */
  | 'default';

/** Standard deviation attached to a value, in that value's own unit. */
export type Sigma = number;

/**
 * A value together with where it came from and how uncertain it is.
 *
 * Used for every input that feeds the score. Values that are structural rather
 * than measured (an id, a name, a component's catalogue length) are plain.
 */
export interface Sourced<T> {
  readonly value: T;
  readonly provenance: Provenance;
  /** Absent means "treat as exact". Present on `estimated` and `default`. */
  readonly sigma?: Sigma;
  /** Free text shown in the UI when the rider asks why a value is uncertain. */
  readonly note?: string;
}

export const sourced = <T>(
  value: T,
  provenance: Provenance,
  sigma?: Sigma,
  note?: string,
): Sourced<T> => {
  const out: { value: T; provenance: Provenance; sigma?: Sigma; note?: string } = {
    value,
    provenance,
  };
  if (sigma !== undefined) out.sigma = sigma;
  if (note !== undefined) out.note = note;
  return out;
};

/** Typical uncertainty by provenance, in millimetres, for length inputs. */
export const DEFAULT_SIGMA_MM: Readonly<Record<Provenance, Sigma>> = {
  measured: 3,
  database: 2,
  imported: 4,
  derived: 5,
  estimated: 20,
  default: 25,
};

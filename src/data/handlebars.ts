/**
 * Handlebar library.
 *
 * The bar is not a detail. It moves the hands 20-40 mm relative to the stem
 * clamp - more than a frame size step - so a fit carried across bikes has to
 * carry the bar with it. Swapping an 80 mm compact for a 76 mm gravel bar
 * changes the position by as much as a stem shim.
 *
 * `reach` is the clamp centre to the forward-most point of the bend.
 * `rise` is how far the grip area sits above the clamp centreline.
 */

export interface BarModel {
  readonly id: string;
  readonly name: string;
  readonly kind: 'road' | 'gravel';
  readonly reach: number;
  readonly drop: number;
  readonly rise: number;
  /** Outward flare of the drops. Recorded for completeness; not used in the sagittal model. */
  readonly flare?: number;
  readonly source?: string;
}

export const BAR_LIBRARY: ReadonlyArray<BarModel> = [
  {
    id: 'fsa-k-wing-agx',
    name: 'FSA K-Wing AGX',
    kind: 'gravel',
    reach: 76, drop: 115, rise: 5, flare: 12,
    source: 'https://www.fsaproshop.com/products/k-wing-agx-carbon-handlebar',
  },
  { id: 'generic-compact', name: 'Generic compact road', kind: 'road', reach: 80, drop: 125, rise: 0 },
  { id: 'generic-shallow', name: 'Generic shallow road', kind: 'road', reach: 75, drop: 115, rise: 0 },
  { id: 'generic-classic', name: 'Generic classic bend', kind: 'road', reach: 95, drop: 145, rise: 0 },
  { id: 'generic-gravel', name: 'Generic flared gravel', kind: 'gravel', reach: 75, drop: 115, rise: 0, flare: 16 },
  { id: 'custom', name: 'Custom — enter values', kind: 'road', reach: 80, drop: 125, rise: 0 },
];

export const barById = (id: string): BarModel | undefined =>
  BAR_LIBRARY.find((b) => b.id === id);

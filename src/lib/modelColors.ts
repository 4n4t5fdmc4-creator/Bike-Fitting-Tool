/**
 * One model-to-colour mapping, shared by every Matrix plot so a model is the
 * same colour in the stack/reach scatter and the hood plot. Slots 1-3 are the
 * cleanly separable ones; past that the plots lean on the direct dot label.
 *
 * The ramp's green sits in the last slot on purpose - the tolerance zones are
 * green and amber, and a model that shared their hue would be unreadable beside
 * them. See the RESERVED HUES note in globals.css.
 */
export const SERIES_VARS = [
  'var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)',
  'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)',
] as const;

export function modelColorMap(models: ReadonlyArray<string>): (model: string) => string {
  const map = new Map(models.map((name, i) => [name, SERIES_VARS[i % SERIES_VARS.length]!]));
  return (model) => map.get(model) ?? SERIES_VARS[0];
}

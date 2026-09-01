/**
 * One model-to-colour mapping, shared by every Matrix plot so a model is the
 * same colour in the stack/reach scatter and the hood plot. Slots 1-3 are the
 * cleanly separable ones; past that the plots lean on the direct dot label.
 */
export const SERIES_VARS = [
  'var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)',
  'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)',
] as const;

export function modelColorMap(models: ReadonlyArray<string>): (model: string) => string {
  const map = new Map(models.map((name, i) => [name, SERIES_VARS[i % SERIES_VARS.length]!]));
  return (model) => map.get(model) ?? SERIES_VARS[0];
}

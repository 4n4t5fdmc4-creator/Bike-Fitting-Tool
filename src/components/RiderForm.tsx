'use client';

import type { RiderInput } from '@/state/store';

/**
 * Tier 1 inputs only. Anything optional is deliberately absent until the UI can
 * state what it buys - see docs/product-spec.md section 6.2.
 */
export function RiderForm({
  rider,
  onChange,
}: {
  rider: RiderInput;
  onChange: (patch: Partial<RiderInput>) => void;
}) {
  // The most common input error by far: a trouser inseam instead of a measured
  // one, which runs 20-40 mm short. Cross-field rule `inseamExceedsHeight`.
  const ratio = rider.inseamCm / rider.heightCm;
  const inseamLooksWrong = ratio < 0.4 || ratio > 0.6;

  return (
    <div className="mt-3 grid gap-4 rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-5 sm:grid-cols-2">
      <Field label="Height" unit="cm" hint="Barefoot.">
        <input
          type="number" min={140} max={210} step={1} value={rider.heightCm}
          onChange={(e) => onChange({ heightCm: Number(e.target.value) })}
          className="tabular w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
        />
      </Field>

      <Field
        label="Inseam" unit="cm"
        hint="Floor to crotch, book pulled up firmly. Not your trouser size."
      >
        <input
          type="number" min={55} max={105} step={0.5} value={rider.inseamCm}
          onChange={(e) => onChange({ inseamCm: Number(e.target.value) })}
          className="tabular w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
        />
      </Field>

      <Field label="Riding style" hint="How stretched out you want to be.">
        <select
          value={rider.style}
          onChange={(e) => onChange({ style: e.target.value as RiderInput['style'] })}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
        >
          <option value="comfort">Comfort — upright</option>
          <option value="allround">Allround</option>
          <option value="performance">Performance — low and long</option>
        </select>
      </Field>

      <Field label="Flexibility" hint="Touching your toes with straight legs?">
        <select
          value={rider.flexibility}
          onChange={(e) => onChange({ flexibility: e.target.value as RiderInput['flexibility'] })}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
        >
          <option value="limited">Limited — nowhere near</option>
          <option value="average">Average — fingertips</option>
          <option value="good">Good — palms flat</option>
        </select>
      </Field>

      {inseamLooksWrong && (
        <p className="sm:col-span-2 rounded-md border border-[var(--status-warning)]/40 bg-[var(--status-warning)]/10 px-3 py-2 text-xs">
          <b>⚠ Check your inseam.</b> {rider.inseamCm} cm against {rider.heightCm} cm of height is
          outside the usual 40–60% range. A trouser inseam is typically 2–4 cm shorter than the
          measured one, and it is the most common mistake here.
        </p>
      )}
    </div>
  );
}

function Field({
  label, unit, hint, children,
}: {
  label: string; unit?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">
        {label}
        {unit ? <span className="ml-1 text-[var(--muted-foreground)]">({unit})</span> : null}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint ? <span className="mt-1 block text-xs text-[var(--muted-foreground)]">{hint}</span> : null}
    </label>
  );
}

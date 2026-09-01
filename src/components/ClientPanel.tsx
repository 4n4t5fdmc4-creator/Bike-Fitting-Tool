'use client';

import { useState } from 'react';
import { useStudio, type Client } from '@/state/studio';
import { downloadJson } from '@/lib/files';

/**
 * One client's record: who they are, what they measure, what the fitter noted.
 * Deliberately separate from the results view - this is the file, not the answer.
 */
export function ClientPanel({ client }: { client: Client }) {
  const { updateClient, updateMeasurements, removeClient, exportClient } = useStudio();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const m = client.measurements;
  const ratio = m.inseamCm / m.heightCm;
  const inseamLooksWrong = ratio < 0.4 || ratio > 0.6;

  return (
    <section className="rounded-[10px] border border-[var(--border)] bg-[var(--panel)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        <input
          value={client.name}
          onChange={(e) => updateClient(client.id, { name: e.target.value })}
          aria-label="Client name"
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-base font-semibold hover:border-[var(--border)] focus:border-[var(--acc)] focus:outline-none"
        />
        <span className="text-xs text-[var(--text-3)]">
          updated {new Date(client.updatedAt).toLocaleDateString()}
        </span>
        <button
          onClick={() => {
            const b = exportClient(client.id);
            if (b) downloadJson(b, `client-${client.name.toLowerCase().replace(/\W+/g, '-')}`);
          }}
          title="Download just this client as readable JSON — check it before you send it anywhere"
          className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-2)] hover:border-[var(--acc)] hover:text-[var(--foreground)]"
        >
          Export client
        </button>
        {confirmDelete ? (
          <span className="flex items-center gap-1.5 text-xs">
            <span className="text-[var(--text-2)]">Delete permanently?</span>
            <button
              onClick={() => removeClient(client.id)}
              className="rounded-md border border-[var(--status-critical)] px-2 py-1 text-[var(--status-critical)]"
            >
              Delete
            </button>
            <button onClick={() => setConfirmDelete(false)} className="px-1 text-[var(--text-2)]">
              Cancel
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-3)] hover:border-[var(--status-critical)] hover:text-[var(--status-critical)]"
          >
            Delete
          </button>
        )}
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Height" unit="cm" hint="Barefoot.">
          <NumberInput
            value={m.heightCm} min={140} max={210} step={1}
            onChange={(v) => updateMeasurements(client.id, { heightCm: v })}
          />
        </Field>
        <Field label="Inseam" unit="cm" hint="Floor to crotch, book pulled up firmly.">
          <NumberInput
            value={m.inseamCm} min={55} max={105} step={0.5}
            onChange={(v) => updateMeasurements(client.id, { inseamCm: v })}
          />
        </Field>
        <Field label="Riding style" hint="How stretched out they want to be.">
          <Select
            value={m.style}
            onChange={(v) => updateMeasurements(client.id, { style: v as typeof m.style })}
            options={[
              ['comfort', 'Comfort — upright'],
              ['allround', 'Allround'],
              ['performance', 'Performance — low and long'],
            ]}
          />
        </Field>
        <Field label="Flexibility" hint="Sit-and-reach, straight legs.">
          <Select
            value={m.flexibility}
            onChange={(v) => updateMeasurements(client.id, { flexibility: v as typeof m.flexibility })}
            options={[
              ['limited', 'Limited — nowhere near'],
              ['average', 'Average — fingertips'],
              ['good', 'Good — palms flat'],
            ]}
          />
        </Field>

        {inseamLooksWrong && (
          <p className="rounded-md border border-[var(--status-warning)]/40 bg-[var(--status-warning)]/10 px-3 py-2 text-xs sm:col-span-2 lg:col-span-4">
            <b>⚠ Check the inseam.</b> {m.inseamCm} cm against {m.heightCm} cm of height is outside
            the usual 40–60% range. A trouser inseam runs 2–4 cm short and is the most common
            mistake in this measurement.
          </p>
        )}

        <label className="block text-sm sm:col-span-2 lg:col-span-4">
          <span className="font-medium">Notes</span>
          <textarea
            value={client.notes}
            onChange={(e) => updateClient(client.id, { notes: e.target.value })}
            rows={2}
            placeholder="Goals, complaints, previous fits. Never used by the calculation."
            className="mt-1.5 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          />
        </label>
      </div>
    </section>
  );
}

function NumberInput({
  value, min, max, step, onChange,
}: { value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number" value={value} min={min} max={max} step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className="tabular w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
    />
  );
}

function Select({
  value, onChange, options,
}: { value: string; onChange: (v: string) => void; options: ReadonlyArray<[string, string]> }) {
  return (
    <select
      value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
    >
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function Field({
  label, unit, hint, children,
}: { label: string; unit?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-medium">
        {label}
        {unit ? <span className="ml-1 text-[var(--text-3)]">({unit})</span> : null}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint ? <span className="mt-1 block text-xs text-[var(--text-3)]">{hint}</span> : null}
    </label>
  );
}

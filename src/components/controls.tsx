'use client';

import { useExplainers } from '@/state/explainers';

/** Small shared form controls used across the comparison tabs. */

/**
 * A titled block of explanation that the fitter can collapse for good.
 *
 * The heading stays visible either way — collapsing hides the prose, not the
 * name of the thing, so a panel never loses its label. `storageKey` is what the
 * collapsed state is remembered under; keep it stable.
 */
export function Explainer({
  title, storageKey, children, aside,
}: {
  title: string;
  storageKey: string;
  children: React.ReactNode;
  /** Rendered on the heading row, right-aligned. Stays visible when collapsed. */
  aside?: React.ReactNode;
}) {
  const collapsed = useExplainers((s) => s.collapsed[storageKey] ?? false);
  const toggle = useExplainers((s) => s.toggle);
  const bodyId = `explainer-${storageKey}`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => toggle(storageKey)}
          aria-expanded={!collapsed}
          aria-controls={bodyId}
          className="group flex items-center gap-1.5 text-left"
        >
          <span
            aria-hidden
            className={`no-print text-[10px] text-[var(--text-3)] transition-transform ${collapsed ? '' : 'rotate-90'}`}
          >
            ▶
          </span>
          <span className="text-xs font-semibold uppercase tracking-widest text-[var(--text-3)] group-hover:text-[var(--text-2)]">
            {title}
          </span>
        </button>
        {aside}
      </div>
      {/*
        Rendered even when collapsed, and hidden with CSS rather than removed,
        so `print:block` can bring it back. Collapsing is a convenience for the
        fitter who already knows; a printed sheet with a heading and nothing
        under it — or worse, a drawing with its "not to scale" caveat silently
        dropped — is not a convenience for the client reading it.
      */}
      <div
        id={bodyId}
        className={collapsed ? 'mt-1.5 hidden print:block' : 'mt-1.5'}
      >
        {children}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
}) {
  return (
    <div className="inline-flex rounded-md border border-[var(--border)] p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded px-2 py-1 transition-colors ${
            value === o.value
              ? 'bg-[var(--panel-2)] font-semibold text-[var(--foreground)]'
              : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const roundToStep = (v: number, step: number) => Math.round(v / step) * step;

export function Range({
  label, unit, v, min, max, step, onChange,
}: {
  label: string; unit: string; v: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-xs">
      <span className="flex items-baseline justify-between">
        <span className="text-[var(--text-2)]">{label}</span>
        <span className="tabular font-semibold">{roundToStep(v, step)} {unit}</span>
      </span>
      <input
        type="range" min={min} max={max} step={step} value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-[var(--acc)]"
      />
    </label>
  );
}

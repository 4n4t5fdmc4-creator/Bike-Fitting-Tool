'use client';

/** Small shared form controls used across the comparison tabs. */

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

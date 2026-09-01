'use client';

import type { DerivedTarget } from '@/engine/target';

/**
 * The numbers a fitter reads first. Everything is BB-relative and measured at
 * the hoods, which is stated rather than assumed - the same figure measured at
 * the stem clamp is 100 mm different.
 */
export function StatRow({
  target,
  fitting,
  total,
}: {
  target: DerivedTarget;
  fitting: number;
  total: number;
}) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-3)]">
        Target position
      </h2>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Stat
          label="Hoods ahead of BB" value={Math.round(target.grip.x)} unit="mm"
          note={`±${Math.round(target.uncertainty)} mm band`}
        />
        <Stat
          label="Hoods above BB" value={Math.round(target.grip.y)} unit="mm"
          note="at the grip, not the clamp"
        />
        <Stat
          label="Saddle height" value={Math.round(target.saddleHeight)} unit="mm"
          note="BB to top, along the seat tube"
        />
        <Stat
          label="Bar drop" value={Math.round(target.drop)} unit="mm"
          note="saddle top above the hoods"
        />
        <Stat
          label="Frames that fit" value={fitting} unit={`of ${total}`}
          note={fitting === 0 ? 'none with an ordinary cockpit' : 'ordinary cockpit, room to adjust'}
          accent
        />
      </div>
      <p className="mt-2 text-xs text-[var(--text-3)]">
        Derived from height and inseam with established rules of thumb — a starting band, not a bike
        fit. Enter a reference bike instead to replace the estimate with a measurement.
      </p>
    </section>
  );
}

function Stat({
  label, value, unit, note, accent,
}: {
  label: string; value: number; unit: string; note: string; accent?: boolean;
}) {
  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--panel)] px-3.5 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
        {label}
      </div>
      <div className="tabular mt-1 text-xl font-semibold" style={accent ? { color: 'var(--acc)' } : undefined}>
        {value} <span className="text-sm font-normal text-[var(--text-3)]">{unit}</span>
      </div>
      <div className="mt-0.5 text-[11px] leading-snug text-[var(--text-3)]">{note}</div>
    </div>
  );
}

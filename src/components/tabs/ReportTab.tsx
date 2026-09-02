'use client';

import type { BbPoint } from '@/domain/units';
import { decisionsOf, useStudio, type Client, type FitDecision } from '@/state/studio';

/**
 * The handover sheet.
 *
 * Everything else in the app is exploration - sliders, overlays, scatter plots -
 * and none of it survives a page reload. This is the one view whose content is
 * on the client record: the builds the fitter committed to, with the numbers
 * frozen at the moment they were adopted.
 *
 * It is written to be printed. A client leaves with a piece of paper that names
 * the frame, the size, the stem, the spacers and how far the result sits from
 * their measured position - enough for any shop to build it without calling.
 */
export function ReportTab({
  client, target, referenceLabel,
}: {
  client: Client;
  target: BbPoint | null;
  referenceLabel: string;
}) {
  const decisions = decisionsOf(client);
  const removeDecision = useStudio((s) => s.removeDecision);
  const updateDecision = useStudio((s) => s.updateDecision);

  return (
    <div className="space-y-4">
      <section className="break-inside-avoid rounded-[10px] border border-[var(--border)] bg-[var(--panel)] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-3)]">
          The position this was fitted to
        </h3>
        <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Height" value={`${client.measurements.heightCm} cm`} />
          <Fact label="Inseam" value={`${client.measurements.inseamCm} cm`} />
          <Fact label="Riding style" value={sentence(client.measurements.style)} />
          <Fact label="Flexibility" value={sentence(client.measurements.flexibility)} />
          <Fact
            label="Target hood reach"
            value={target ? `${target.x.toFixed(0)} mm` : '—'}
            hint="from the bottom bracket"
          />
          <Fact
            label="Target hood stack"
            value={target ? `${target.y.toFixed(0)} mm` : '—'}
            hint="from the bottom bracket"
          />
          <Fact label="Measured against" value={sentence(referenceLabel)} />
          <Fact
            label="Basis"
            value={client.targetMode === 'reference' ? 'The client’s own bike' : 'Body measurements'}
          />
        </dl>
        {client.targetMode !== 'reference' && (
          <p className="mt-3 text-[11px] text-[var(--status-warning)]">
            No reference bike on file — the target is estimated from body measurements and carries
            more uncertainty than a measured position.
          </p>
        )}
      </section>

      {decisions.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-[var(--border)] bg-[var(--panel)] px-4 py-10 text-center text-sm text-[var(--text-3)]">
          Nothing recorded yet. In step 2 → <b>Accufit</b>, press <b>Adopt</b> on a configuration to
          put it on this sheet. Adopted builds are stored on the client record and survive a reload.
        </p>
      ) : (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Recommended builds ({decisions.length})
          </h3>
          {decisions.map((d) => (
            <DecisionCard
              key={d.id}
              d={d}
              onNote={(note) => updateDecision(client.id, d.id, { note })}
              onRemove={() => removeDecision(client.id, d.id)}
            />
          ))}
        </section>
      )}

      {client.notes.trim() && (
        <section className="break-inside-avoid rounded-[10px] border border-[var(--border)] bg-[var(--panel)] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Session notes
          </h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-2)]">{client.notes}</p>
        </section>
      )}
    </div>
  );
}

function DecisionCard({
  d, onNote, onRemove,
}: {
  d: FitDecision;
  onNote: (note: string) => void;
  onRemove: () => void;
}) {
  const miss = Math.hypot(d.deltaX, d.deltaY);
  return (
    <article className="break-inside-avoid rounded-[10px] border border-[var(--border)] bg-[var(--panel)] p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-base font-semibold">{d.label}</h4>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--text-3)]">
            recorded {new Date(d.decidedAt).toLocaleDateString()}
          </span>
          <button
            onClick={onRemove}
            className="no-print rounded-md border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--text-3)] hover:border-[var(--status-bad)] hover:text-[var(--foreground)]"
          >
            Remove
          </button>
        </div>
      </header>

      <p className="mt-2 text-sm">
        <b className="tabular">{d.stemLength} mm</b> stem at{' '}
        <b className="tabular">{d.stemAngle > 0 ? `+${d.stemAngle}` : d.stemAngle}°</b>,{' '}
        <b className="tabular">{d.spacerHeight} mm</b> of spacers, on a{' '}
        <span className="tabular">{d.barReach.toFixed(0)}×{d.barRise.toFixed(0)}</span> bar.
      </p>

      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Hood reach" value={`${d.hoodX.toFixed(0)} mm`} hint="from the bottom bracket" />
        <Fact label="Hood stack" value={`${d.hoodY.toFixed(0)} mm`} hint="from the bottom bracket" />
        <Fact label="Accufit X" value={`${d.clampX.toFixed(0)} mm`} hint="BB to bar centre" />
        <Fact label="Accufit Y" value={`${d.clampY.toFixed(0)} mm`} hint="BB to bar centre" />
      </dl>

      <p className="mt-3 text-xs">
        <span className="text-[var(--text-3)]">Against the target: </span>
        <span
          className="tabular font-semibold"
          style={{ color: miss <= 2 ? 'var(--status-good)' : 'var(--foreground)' }}
        >
          {signed(d.deltaX)} mm reach, {signed(d.deltaY)} mm stack
        </span>
        <span className="text-[var(--text-3)]"> ({miss.toFixed(1)} mm total)</span>
      </p>

      <label className="mt-3 block">
        <span className="text-[11px] text-[var(--text-3)]">Note for the client</span>
        <textarea
          value={d.note}
          onChange={(e) => onNote(e.target.value)}
          rows={2}
          placeholder="Why this one, what to watch, what was ruled out."
          className="no-print mt-1 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm outline-none focus:border-[var(--acc)]"
        />
        {d.note.trim() && (
          <span className="print-only mt-1 whitespace-pre-wrap text-sm">{d.note}</span>
        )}
      </label>
    </article>
  );
}

/**
 * First letter up, the rest untouched. A blanket `capitalize` was doing this
 * to the numbers too and printing "588 Mm" and "178 Cm" on the handover sheet.
 */
const sentence = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

const signed = (v: number): string => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`;

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-[11px] text-[var(--text-3)]">{label}</dt>
      <dd className="tabular text-sm font-medium">{value}</dd>
      {hint && <dd className="text-[11px] text-[var(--text-3)]">{hint}</dd>}
    </div>
  );
}

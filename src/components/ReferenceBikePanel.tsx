'use client';

import { mm, deg } from '@/domain/units';
import { gripPoint } from '@/engine/forward';
import { resolveCockpit } from '@/engine/assumptions';
import { useStudio, DEFAULT_REFERENCE, type Client } from '@/state/studio';

/**
 * The client's current bike as the target.
 *
 * This is the better of the two entry points by a wide margin: it MEASURES the
 * position they already ride instead of estimating one from height and inseam.
 * The estimate exists for clients who arrive without a bike worth copying.
 */
export function ReferenceBikePanel({ client }: { client: Client }) {
  const updateClient = useStudio((s) => s.updateClient);
  const ref = client.referenceBike;

  const grip = ref
    ? gripPoint(
        { stack: mm(ref.stack), reach: mm(ref.reach), headTubeAngle: deg(ref.headTubeAngle) },
        resolveCockpit({
          stemLength: mm(ref.stemLength),
          stemAngle: deg(ref.stemAngle),
          spacerHeight: mm(ref.spacerHeight),
          barReach: mm(ref.barReach),
          barRise: mm(ref.barRise),
        }),
      )
    : null;

  const set = (patch: Partial<NonNullable<Client['referenceBike']>>) =>
    updateClient(client.id, { referenceBike: { ...(ref ?? DEFAULT_REFERENCE), ...patch } });

  return (
    <section className="rounded-[10px] border border-[var(--border)] bg-[var(--panel)]">
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-3)]">
          Reference bike
        </h2>
        <div className="ml-auto flex items-center gap-1 rounded-md border border-[var(--border)] p-0.5 text-xs">
          <button
            onClick={() => updateClient(client.id, { targetMode: 'derived' })}
            className={`rounded px-2 py-1 ${client.targetMode === 'derived' ? 'bg-[var(--acc)] text-black font-semibold' : 'text-[var(--text-2)]'}`}
          >
            Estimate from body
          </button>
          <button
            onClick={() =>
              updateClient(client.id, {
                targetMode: 'reference',
                referenceBike: ref ?? DEFAULT_REFERENCE,
              })
            }
            className={`rounded px-2 py-1 ${client.targetMode === 'reference' ? 'bg-[var(--acc)] text-black font-semibold' : 'text-[var(--text-2)]'}`}
          >
            Measure their bike
          </button>
        </div>
      </div>

      {client.targetMode !== 'reference' ? (
        <p className="px-4 py-3 text-xs text-[var(--text-3)]">
          Currently estimating the target from height and inseam. If the client already rides a bike
          that suits them, measuring it is far more accurate — no formula involved.
        </p>
      ) : (
        <div className="p-4">
          <input
            value={ref?.label ?? ''}
            onChange={(e) => set({ label: e.target.value })}
            placeholder="e.g. Pinarello Grevil F 550"
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-medium"
          />

          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
            Frame — from the manufacturer geometry table
          </p>
          <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Num label="Stack" v={ref?.stack} onChange={(v) => set({ stack: v })} unit="mm" />
            <Num label="Reach" v={ref?.reach} onChange={(v) => set({ reach: v })} unit="mm" />
            <Num label="Head angle" v={ref?.headTubeAngle} onChange={(v) => set({ headTubeAngle: v })} unit="°" step={0.1} />
          </div>

          <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-3)]">
            Cockpit — as actually ridden
          </p>
          <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Num label="Stem" v={ref?.stemLength} onChange={(v) => set({ stemLength: v })} unit="mm" />
            <Num label="Stem angle" v={ref?.stemAngle} onChange={(v) => set({ stemAngle: v })} unit="°" />
            <Num label="Spacers" v={ref?.spacerHeight} onChange={(v) => set({ spacerHeight: v })} unit="mm" />
            <Num label="Bar reach" v={ref?.barReach} onChange={(v) => set({ barReach: v })} unit="mm" />
            <Num label="Bar rise" v={ref?.barRise} onChange={(v) => set({ barRise: v })} unit="mm" />
          </div>

          {grip && (
            <p className="mt-3 rounded-md bg-[var(--panel-2)] px-3 py-2 text-xs">
              This bike puts the hoods <b className="tabular">{Math.round(grip.x)} mm</b> ahead of
              and <b className="tabular">{Math.round(grip.y)} mm</b> above the bottom bracket. That
              is the target every recommendation below is measured against — no estimate involved.
            </p>
          )}
          <p className="mt-2 text-[11px] text-[var(--text-3)]">
            Spacers means everything under the stem including the headset top cap. Stem angle is the
            number printed on the stem, negative for the usual downward orientation.
          </p>
        </div>
      )}
    </section>
  );
}

function Num({
  label, v, onChange, unit, step = 1,
}: { label: string; v: number | undefined; onChange: (v: number) => void; unit: string; step?: number }) {
  return (
    <label className="block text-xs">
      <span className="text-[var(--text-2)]">{label} <span className="text-[var(--text-3)]">{unit}</span></span>
      <input
        type="number" value={v ?? 0} step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="tabular mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm"
      />
    </label>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { deg, mm, type BbPoint } from '@/domain/units';
import { resolveCockpit } from '@/engine/assumptions';
import type { FrameCore } from '@/engine/forward';
import {
  ACCUFIT_TOLERANCE_MM,
  accufitOptions,
  describeMiss,
  type AccufitOption,
} from '@/engine/accufit';
import type { ModelRecommendation } from '@/engine/recommend';
import type { ReferenceBike } from '@/state/studio';
import { useStudio } from '@/state/studio';
import { useOverlaySelection } from '@/state/overlaySelection';

/**
 * The buildable-configuration view, after Wilier's Accufit tables.
 *
 * Accufit publishes, per frame size, the bottom-bracket-to-handlebar-centre
 * coordinate for each combination of spacers and stem the bike is sold with -
 * a discrete grid roughly 2 mm apart, not a formula. That is the honest way to
 * answer "will this bike fit": the solver's "stem 103.4 mm" is a number nobody
 * can order, and rounding it silently hides which way the rounding went.
 *
 * So every row here is a build a shop can actually assemble, and the miss is
 * stated rather than absorbed. Adopting a row writes it to the client record,
 * which is the only thing in the app that survives a page reload.
 */
export function AccufitPanel({
  models, target, referenceBike, clientId,
}: {
  models: ReadonlyArray<ModelRecommendation>;
  target: BbPoint | null;
  referenceBike: ReferenceBike | null;
  clientId: string;
}) {
  const selected = useOverlaySelection((s) => s.selectedIds);
  const addDecision = useStudio((s) => s.addDecision);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // What is already on the record, not what was clicked this render. Local
  // "just adopted" state could only remember one row, so adopting a second made
  // the first look un-adopted, and nothing stopped the same build being written
  // twice - two identical entries on the client's sheet.
  const client = useStudio((s) => s.clients.find((c) => c.id === clientId));
  const adopted = useMemo(
    () =>
      new Set(
        (client?.decisions ?? []).map(
          (d) => `${d.frameId}:${d.stemLength}/${d.stemAngle}/${d.spacerHeight}`,
        ),
      ),
    [client],
  );

  // The client's own bar travels with them onto every candidate frame - a fit
  // is carried across bikes by its contact points, not by a generic bar.
  const base = useMemo(
    () =>
      resolveCockpit({
        barReach: mm(referenceBike?.barReach ?? 80),
        barRise: mm(referenceBike?.barRise ?? 0),
      }),
    [referenceBike],
  );

  const bySize = useMemo(
    () => models.flatMap((m) => m.allSizes.map((s) => ({ model: m.model, ...s }))),
    [models],
  );

  const chosen = selected
    .map((id) => bySize.find((s) => s.frame.id === id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined);

  if (!target) {
    return (
      <Empty>
        No target position yet — set the client’s measurements or reference bike in step 1.
      </Empty>
    );
  }

  if (chosen.length === 0) {
    return <Empty>Pick frames in the Overlay view — their configurations appear here.</Empty>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[10px] border border-[var(--border)] bg-[var(--panel)] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-3)]">
          Buildable configurations
        </h3>
        <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-[var(--text-2)]">
          Every row is a cockpit that can be ordered: stems in 10 mm steps at the four angles that
          are actually sold, spacers in 5 mm steps up to each frame’s own limit. The{' '}
          <b>Accufit point</b> is the distance from the bottom bracket centre to the handlebar
          centre — the same coordinate Wilier publishes per size, so a row here can be checked
          against a manufacturer’s table. Rows are ranked by where the <i>hands</i> end up, not by
          that point, because the bar’s own reach sits between the two.
        </p>
        <p className="mt-2 text-[11px] text-[var(--text-3)]">
          Target hood position: <span className="tabular">{target.x.toFixed(0)}</span> mm reach,{' '}
          <span className="tabular">{target.y.toFixed(0)}</span> mm stack, from the bottom bracket.
          Anything inside {ACCUFIT_TOLERANCE_MM} mm counts as on target.
        </p>
      </section>

      {chosen.map((s) => {
        const core: FrameCore = {
          stack: mm(s.frame.stack),
          reach: mm(s.frame.reach),
          headTubeAngle: deg(s.frame.headTubeAngle),
        };
        const rows = accufitOptions(core, base, target, { maxSpacer: s.frame.maxSpacerStack });
        const open = expanded[s.frame.id] ?? false;
        const shown = open ? rows.slice(0, 24) : rows.slice(0, 5);
        const best = rows[0];

        return (
          <section
            key={s.frame.id}
            className="break-inside-avoid rounded-[10px] border border-[var(--border)] bg-[var(--panel)] p-4"
          >
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-sm font-semibold">
                {s.model} <span className="text-[var(--text-2)]">{s.frame.size}</span>
              </h4>
              {best && (
                <span className="text-xs text-[var(--text-2)]">
                  best buildable:{' '}
                  <b className={best.miss <= ACCUFIT_TOLERANCE_MM ? 'text-[var(--status-good)]' : ''}>
                    {describeMiss(best)}
                  </b>
                </span>
              )}
            </header>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[var(--text-3)]">
                    <Th>Stem</Th>
                    <Th>Angle</Th>
                    <Th>Spacers</Th>
                    <Th title="Bottom bracket to handlebar centre, horizontal">Accufit X</Th>
                    <Th title="Bottom bracket to handlebar centre, vertical">Accufit Y</Th>
                    <Th title="Hood reach against the target">Δ reach</Th>
                    <Th title="Hood stack against the target">Δ stack</Th>
                    <Th>Miss</Th>
                    <th className="no-print py-1.5 pl-2" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((o, i) => (
                    <Row
                      key={o.id}
                      o={o}
                      isBest={i === 0 && !open}
                      adopted={adopted.has(`${s.frame.id}:${o.id}`)}
                      onAdopt={() => {
                        addDecision(clientId, {
                          frameId: s.frame.id,
                          label: `${s.model} ${s.frame.size}`,
                          stemLength: o.stemLength,
                          stemAngle: o.stemAngle,
                          spacerHeight: o.spacerHeight,
                          barReach: base.barReach,
                          barRise: base.barRise,
                          hoodX: o.hood.x,
                          hoodY: o.hood.y,
                          clampX: o.clamp.x,
                          clampY: o.clamp.y,
                          deltaX: o.delta.x,
                          deltaY: o.delta.y,
                          note: '',
                        });
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={() => setExpanded((p) => ({ ...p, [s.frame.id]: !open }))}
              className="no-print mt-2 text-[11px] text-[var(--text-3)] underline-offset-2 hover:text-[var(--text-2)] hover:underline"
            >
              {open
                ? 'Show only the closest five'
                : `Show more of the ${rows.length} configurations`}
            </button>
          </section>
        );
      })}
    </div>
  );
}

function Row({
  o, isBest, adopted, onAdopt,
}: {
  o: AccufitOption;
  isBest: boolean;
  adopted: boolean;
  onAdopt: () => void;
}) {
  const onTarget = o.miss <= ACCUFIT_TOLERANCE_MM;
  return (
    <tr
      className="border-b border-[var(--border)]/50 last:border-0"
      style={isBest ? { background: 'var(--panel-2)' } : undefined}
    >
      <Td>{o.stemLength} mm</Td>
      <Td>{o.stemAngle > 0 ? `+${o.stemAngle}` : o.stemAngle}°</Td>
      <Td>{o.spacerHeight} mm</Td>
      <Td>{o.clamp.x.toFixed(0)}</Td>
      <Td>{o.clamp.y.toFixed(0)}</Td>
      <Td signed>{o.delta.x}</Td>
      <Td signed>{o.delta.y}</Td>
      <td className="tabular py-1.5 pr-3">
        <span className={onTarget ? 'font-semibold text-[var(--status-good)]' : ''}>
          {o.miss.toFixed(1)} mm
        </span>
      </td>
      <td className="no-print py-1.5 pl-2 text-right">
        <button
          onClick={onAdopt}
          disabled={adopted}
          className="rounded-md border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--text-2)] transition-colors hover:border-[var(--acc)] hover:text-[var(--foreground)] disabled:opacity-50"
        >
          {adopted ? 'Recorded' : 'Adopt'}
        </button>
      </td>
    </tr>
  );
}

function Th({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <th scope="col" title={title} className="py-1.5 pr-3 font-medium">
      {children}
    </th>
  );
}

function Td({ children, signed }: { children: React.ReactNode; signed?: boolean }) {
  if (signed && typeof children === 'number') {
    const v = children;
    const near = Math.abs(v) < 1;
    return (
      <td className="tabular py-1.5 pr-3">
        <span className={near ? 'text-[var(--text-3)]' : ''}>
          {v > 0 ? '+' : v < 0 ? '−' : ''}
          {Math.abs(v).toFixed(1)}
        </span>
      </td>
    );
  }
  return <td className="tabular py-1.5 pr-3">{children}</td>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[10px] border border-dashed border-[var(--border)] bg-[var(--panel)] px-4 py-8 text-center text-sm text-[var(--text-3)]">
      {children}
    </p>
  );
}

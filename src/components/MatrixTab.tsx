'use client';

import { useMemo, useState } from 'react';
import { downloadCsv } from '@/lib/csv';
import { withinFitRadius } from '@/lib/fitRadius';

export interface MatrixRow {
  readonly id: string;
  readonly model: string;
  readonly size: string;
  readonly stack: number;
  readonly reach: number;
  readonly deltaStack: number;
  readonly deltaReach: number;
  readonly requiredStem: number;
  readonly requiredSpacers: number;
  readonly score: number;
  readonly verdict: string;
}

/**
 * Stack/reach matrix against the reference, with an adjustable fit radius.
 *
 * The radius is two independent bounds, not a circle: reach and stack are
 * felt differently and riders tolerate them differently (see the asymmetric
 * tolerance discussion in product-spec.md) - a single "distance" number would
 * hide which axis actually blew the budget.
 */
export function MatrixTab({
  rows, referenceLabel, anchorIsEstimated,
}: { rows: ReadonlyArray<MatrixRow>; referenceLabel: string; anchorIsEstimated?: boolean }) {
  const [maxReach, setMaxReach] = useState(15);
  const [maxStack, setMaxStack] = useState(20);
  const [onlyWithinRadius, setOnlyWithinRadius] = useState(false);
  const [sortKey, setSortKey] = useState<'score' | 'deltaReach' | 'deltaStack'>('score');

  const withinRadius = (r: MatrixRow) => withinFitRadius(r.deltaReach, r.deltaStack, maxReach, maxStack);

  const sorted = useMemo(() => {
    const filtered = onlyWithinRadius ? rows.filter(withinRadius) : rows;
    return [...filtered].sort((a, b) => {
      if (sortKey === 'score') return b.score - a.score;
      if (sortKey === 'deltaReach') return Math.abs(a.deltaReach) - Math.abs(b.deltaReach);
      return Math.abs(a.deltaStack) - Math.abs(b.deltaStack);
    });
  }, [rows, onlyWithinRadius, maxReach, maxStack, sortKey]);

  const inRadiusCount = rows.filter(withinRadius).length;

  return (
    <div className="space-y-4">
      <div className="rounded-[10px] border border-[var(--border)] bg-[var(--panel)] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-3)]">
          Fit radius — how far from {referenceLabel} still counts as close
        </h3>
        {anchorIsEstimated && (
          <p className="mt-1 text-[11px] text-[var(--text-3)]">
            No reference bike is on file, so the anchor is an estimated frame stack/reach derived
            from the target position with a typical head angle — narrower with a real reference bike.
          </p>
        )}
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block text-xs">
            <span className="flex items-baseline justify-between">
              <span className="text-[var(--text-2)]">Reach tolerance</span>
              <span className="tabular font-semibold">± {maxReach} mm</span>
            </span>
            <input type="range" min={0} max={40} step={1} value={maxReach}
              onChange={(e) => setMaxReach(Number(e.target.value))}
              className="mt-1.5 w-full accent-[var(--acc)]" />
          </label>
          <label className="block text-xs">
            <span className="flex items-baseline justify-between">
              <span className="text-[var(--text-2)]">Stack tolerance</span>
              <span className="tabular font-semibold">± {maxStack} mm</span>
            </span>
            <input type="range" min={0} max={50} step={1} value={maxStack}
              onChange={(e) => setMaxStack(Number(e.target.value))}
              className="mt-1.5 w-full accent-[var(--acc)]" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={onlyWithinRadius} onChange={(e) => setOnlyWithinRadius(e.target.checked)} />
            Show only sizes within radius
          </label>
          <span className="text-[var(--text-3)]">
            {inRadiusCount} of {rows.length} sizes within the current radius
          </span>
          <button
            onClick={() =>
              downloadCsv(
                `fit-matrix-${new Date().toISOString().slice(0, 10)}.csv`,
                ['Model', 'Size', 'Stack', 'Reach', 'ΔStack', 'ΔReach', 'Within radius', 'Required stem (mm)', 'Required spacers (mm)', 'Score', 'Verdict'],
                sorted.map((r) => [
                  r.model, r.size, r.stack, r.reach, r.deltaStack.toFixed(0), r.deltaReach.toFixed(0),
                  withinRadius(r) ? 'yes' : 'no', r.requiredStem.toFixed(0), r.requiredSpacers.toFixed(0),
                  r.score.toFixed(1), r.verdict,
                ]),
              )
            }
            className="ml-auto rounded-md border border-[var(--border)] px-2.5 py-1 text-[var(--text-2)] hover:border-[var(--acc)] hover:text-[var(--foreground)]"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[10px] border border-[var(--border)]">
        <table className="tabular w-full min-w-[52rem] text-sm">
          <thead className="bg-[var(--panel-2)] text-left text-[11px] uppercase tracking-wider text-[var(--text-3)]">
            <tr>
              <th className="px-3 py-2">Model</th>
              <th className="px-2 py-2">Size</th>
              <th className="px-2 py-2 text-right">Stack</th>
              <th className="px-2 py-2 text-right">Reach</th>
              <SortableTh label="Δ Stack" active={sortKey === 'deltaStack'} onClick={() => setSortKey('deltaStack')} />
              <SortableTh label="Δ Reach" active={sortKey === 'deltaReach'} onClick={() => setSortKey('deltaReach')} />
              <th className="px-2 py-2 text-right">Stem</th>
              <th className="px-2 py-2 text-right">Spacers</th>
              <SortableTh label="Score" active={sortKey === 'score'} onClick={() => setSortKey('score')} />
              <th className="px-2 py-2">Radius</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const inR = withinRadius(r);
              return (
                <tr key={r.id} className={`border-t border-[var(--border)] ${inR ? '' : 'opacity-50'}`}>
                  <td className="px-3 py-2">{r.model}</td>
                  <td className="px-2 py-2 font-medium">{r.size}</td>
                  <td className="px-2 py-2 text-right">{r.stack.toFixed(0)}</td>
                  <td className="px-2 py-2 text-right">{r.reach.toFixed(0)}</td>
                  <td className="px-2 py-2 text-right">{r.deltaStack >= 0 ? '+' : ''}{r.deltaStack.toFixed(0)}</td>
                  <td className="px-2 py-2 text-right">{r.deltaReach >= 0 ? '+' : ''}{r.deltaReach.toFixed(0)}</td>
                  <td className="px-2 py-2 text-right">{r.requiredStem.toFixed(0)}</td>
                  <td className="px-2 py-2 text-right">{r.requiredSpacers.toFixed(0)}</td>
                  <td className="px-2 py-2 text-right font-semibold">{r.score.toFixed(0)}</td>
                  <td className="px-2 py-2">
                    {inR ? (
                      <span className="rounded-full bg-[color-mix(in_srgb,var(--status-good)_16%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--status-good)]">
                        ✓ in radius
                      </span>
                    ) : (
                      <span className="text-[11px] text-[var(--text-3)]">outside</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-6 text-center text-[var(--text-3)]">No sizes within this radius.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortableTh({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <th className="px-2 py-2 text-right">
      <button onClick={onClick} className={`hover:text-[var(--foreground)] ${active ? 'text-[var(--acc)]' : ''}`}>
        {label}{active ? ' ▾' : ''}
      </button>
    </th>
  );
}

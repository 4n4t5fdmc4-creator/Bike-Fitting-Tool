'use client';

import { useMemo, useState } from 'react';
import { downloadCsv } from '@/lib/csv';
import { DEFAULT_FIT_TOLERANCE, withinFitRadius, type FitTolerance } from '@/lib/fitRadius';
import { useOverlaySelection } from '@/state/overlaySelection';
import { useComparisonMode } from '@/state/comparisonMode';
import { Range, Segmented } from './controls';
import { StackReachScatter } from './StackReachScatter';
import { HoodScatter } from './HoodScatter';

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

interface XY { readonly x: number; readonly y: number }

/** A frame's hood grip position under each build, for the hood plot. */
export interface HoodRow {
  readonly id: string;
  readonly model: string;
  readonly size: string;
  readonly asFitted: XY;
  readonly sameCockpit: XY;
}

/**
 * Stack/reach matrix against the reference, with an adjustable fit tolerance.
 *
 * The tolerance is four independent bounds, not a circle: short, long, low and
 * high are felt and tolerated differently (see the asymmetric-tolerance
 * discussion in product-spec.md). The scatter above the table and the table's
 * in-radius column read the SAME four numbers - one source of truth.
 */
export function MatrixTab({
  rows, anchor, referenceLabel, anchorIsEstimated,
  hoodRows, referenceGrip, referenceHood,
}: {
  rows: ReadonlyArray<MatrixRow>;
  anchor: { stack: number; reach: number };
  referenceLabel: string;
  anchorIsEstimated?: boolean;
  hoodRows: ReadonlyArray<HoodRow>;
  /** Reference hood position - centre of the target window. */
  referenceGrip: XY;
  /** The reference bike's own hood under each build, or null when estimated. */
  referenceHood: { asFitted: XY; sameCockpit: XY } | null;
}) {
  const [tol, setTol] = useState<FitTolerance>(DEFAULT_FIT_TOLERANCE);
  const [onlyWithinRadius, setOnlyWithinRadius] = useState(false);
  const [sortKey, setSortKey] = useState<'score' | 'deltaReach' | 'deltaStack'>('score');
  const [plot, setPlot] = useState<'frame' | 'hood'>('frame');

  const setField = (k: keyof FitTolerance) => (v: number) => setTol((t) => ({ ...t, [k]: v }));

  const overlaySelected = useOverlaySelection((s) => s.selectedIds);
  const labelledIds = useMemo(() => new Set(overlaySelected), [overlaySelected]);

  // Same toggle and cockpit as the Compare overlay - one shared source.
  const fitMode = useComparisonMode((s) => s.fitMode);
  const setFitMode = useComparisonMode((s) => s.setFitMode);
  const cockpit = useComparisonMode((s) => s.cockpit);
  const setCockpit = useComparisonMode((s) => s.setCockpit);

  const hoodPoints = useMemo(
    () => hoodRows.map((r) => ({
      id: r.id, model: r.model, size: r.size,
      ...(fitMode === 'as-fitted' ? r.asFitted : r.sameCockpit),
    })),
    [hoodRows, fitMode],
  );
  const referenceMarker = referenceHood
    ? (fitMode === 'as-fitted' ? referenceHood.asFitted : referenceHood.sameCockpit)
    : null;

  const withinRadius = (r: MatrixRow) => withinFitRadius(r.deltaReach, r.deltaStack, tol);

  const sorted = useMemo(() => {
    const filtered = onlyWithinRadius ? rows.filter(withinRadius) : rows;
    return [...filtered].sort((a, b) => {
      if (sortKey === 'score') return b.score - a.score;
      if (sortKey === 'deltaReach') return Math.abs(a.deltaReach) - Math.abs(b.deltaReach);
      return Math.abs(a.deltaStack) - Math.abs(b.deltaStack);
    });
  }, [rows, onlyWithinRadius, tol, sortKey]);

  const inRadiusCount = rows.filter(withinRadius).length;

  return (
    <div className="space-y-4">
      <div className="rounded-[10px] border border-[var(--border)] bg-[var(--panel)] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-3)]">
          Fit tolerance — how far from {referenceLabel} still counts as close
        </h3>
        {anchorIsEstimated && (
          <p className="mt-1 text-[11px] text-[var(--text-3)]">
            No reference bike is on file, so the anchor is an estimated frame stack/reach derived
            from the target position with a typical head angle — narrower with a real reference bike.
          </p>
        )}
        <p className="mt-1 text-[11px] text-[var(--text-3)]">
          Shorter and longer in reach, lower and higher in stack are set separately — a frame that
          comes up short can be pulled back with a longer stem, one that runs long usually cannot.
        </p>
        <div className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tol label="Reach — shorter" v={tol.xs} max={40} onChange={setField('xs')} />
          <Tol label="Reach — longer" v={tol.xl} max={40} onChange={setField('xl')} />
          <Tol label="Stack — lower" v={tol.yl} max={50} onChange={setField('yl')} />
          <Tol label="Stack — higher" v={tol.yh} max={50} onChange={setField('yh')} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={onlyWithinRadius} onChange={(e) => setOnlyWithinRadius(e.target.checked)} />
            Show only sizes within tolerance
          </label>
          <span className="text-[var(--text-3)]">
            {inRadiusCount} of {rows.length} sizes within the current tolerance
          </span>
          <button
            onClick={() =>
              downloadCsv(
                `fit-matrix-${new Date().toISOString().slice(0, 10)}.csv`,
                ['Model', 'Size', 'Stack', 'Reach', 'ΔStack', 'ΔReach', 'Within tolerance', 'Required stem (mm)', 'Required spacers (mm)', 'Score', 'Verdict'],
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

      <div className="rounded-[10px] border border-[var(--border)] bg-[var(--panel)] p-3">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            value={plot}
            onChange={setPlot}
            options={[
              { value: 'frame', label: 'Frame stack / reach' },
              { value: 'hood', label: 'Hood position' },
            ]}
          />
          {plot === 'hood' && (
            <Segmented
              value={fitMode}
              onChange={setFitMode}
              options={[
                { value: 'as-fitted', label: 'As fitted' },
                { value: 'same-cockpit', label: 'Same cockpit' },
              ]}
            />
          )}
          <span className="text-[11px] text-[var(--text-3)]">
            {plot === 'frame'
              ? 'Where each frame ends — raw stack and reach.'
              : 'Where the hands end up once the cockpit is applied, relative to the BB.'}
          </span>
        </div>

        {plot === 'hood' && fitMode === 'same-cockpit' && (
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Range label="Stem" unit="mm" v={cockpit.stemLength} min={60} max={140} step={5} onChange={(v) => setCockpit({ stemLength: v })} />
            <Range label="Stem angle" unit="°" v={cockpit.stemAngle} min={-17} max={17} step={1} onChange={(v) => setCockpit({ stemAngle: v })} />
            <Range label="Spacers" unit="mm" v={cockpit.spacerHeight} min={0} max={50} step={2.5} onChange={(v) => setCockpit({ spacerHeight: v })} />
            <Range label="Bar reach" unit="mm" v={cockpit.barReach} min={65} max={100} step={1} onChange={(v) => setCockpit({ barReach: v })} />
            <Range label="Bar rise" unit="mm" v={cockpit.barRise} min={0} max={40} step={1} onChange={(v) => setCockpit({ barRise: v })} />
          </div>
        )}
        {plot === 'hood' && fitMode === 'same-cockpit' && (
          <p className="mt-2 text-[11px] text-[var(--text-3)]">
            These sliders are shared with the Compare tab.
          </p>
        )}

        <div className="mt-3">
          {plot === 'frame' ? (
            <StackReachScatter
              rows={rows}
              reference={{ stack: anchor.stack, reach: anchor.reach }}
              referenceLabel={referenceLabel}
              tol={tol}
              labelledIds={labelledIds}
              anchorIsEstimated={anchorIsEstimated}
            />
          ) : (
            <HoodScatter
              points={hoodPoints}
              reference={referenceGrip}
              referenceMarker={referenceMarker}
              referenceLabel={referenceLabel}
              tol={tol}
              labelledIds={labelledIds}
              mode={fitMode}
              anchorIsEstimated={anchorIsEstimated}
            />
          )}
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
              <tr><td colSpan={10} className="px-3 py-6 text-center text-[var(--text-3)]">No sizes within this tolerance.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tol({
  label, v, max, onChange,
}: { label: string; v: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-xs">
      <span className="flex items-baseline justify-between">
        <span className="text-[var(--text-2)]">{label}</span>
        <span className="tabular font-semibold">{v} mm</span>
      </span>
      <input type="range" min={0} max={max} step={1} value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-[var(--acc)]" />
    </label>
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

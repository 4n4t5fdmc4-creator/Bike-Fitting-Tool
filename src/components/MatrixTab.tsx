'use client';

import { useMemo, useState } from 'react';
import { downloadCsv } from '@/lib/csv';
import { DEFAULT_FIT_TOLERANCE, withinFitRadius, type FitTolerance } from '@/lib/fitRadius';
import { useOverlaySelection } from '@/state/overlaySelection';
import { useComparisonMode } from '@/state/comparisonMode';
import { Explainer, Range, Segmented } from './controls';
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

  /**
   * Manufacturer-table columns, all optional: a value is shown only when the
   * source publishes it and is never inferred from another field. Blank in the
   * table means "not published", not "zero".
   */
  readonly trail?: number | undefined;
  readonly wheelbase?: number | undefined;
  readonly chainstay?: number | undefined;
  readonly tyreMax?: number | undefined;
  readonly cockpitType?: 'open' | 'semi-integrated' | 'integrated' | undefined;
  readonly stockStem?: number | undefined;
  readonly stockStemAngle?: number | undefined;
  readonly stockSpacers?: number | undefined;
  readonly sourceUrl?: string | undefined;

  /** The client's own bike, pinned and marked. */
  readonly isReference?: boolean | undefined;

  /**
   * Vertical hood travel still available below / above the recommended build,
   * within the frame's own spacer limit. Millimetres.
   */
  readonly adjustDown: number;
  readonly adjustUp: number;
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
  rows, referenceRow, anchor, referenceLabel, anchorIsEstimated,
  hoodRows, referenceGrip, referenceHood,
}: {
  rows: ReadonlyArray<MatrixRow>;
  /** The client's own bike, rendered pinned above the catalogue rows. */
  referenceRow: MatrixRow | null;
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
  const [wideTyresOnly, setWideTyresOnly] = useState(false);
  const [cockpitFilter, setCockpitFilter] =
    useState<'all' | 'open' | 'semi-integrated' | 'integrated'>('all');
  const [sortKey, setSortKey] = useState<'score' | 'deltaReach' | 'deltaStack'>('score');
  const [plot, setPlot] = useState<'frame' | 'hood'>('frame');
  /**
   * Eighteen columns is a spreadsheet, not a table: it scrolled sideways, and
   * the two columns that decide anything - score and whether the frame is in
   * tolerance - slid off screen while the fitter was reading trail and
   * wheelbase. The fit columns are always shown and the model column is pinned;
   * the rest are two groups the fitter opens when the question arises.
   */
  const [showGeometry, setShowGeometry] = useState(false);
  const [showBuild, setShowBuild] = useState(false);

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

  // A tyre-clearance filter can only keep a row it can confirm: a frame whose
  // table never published a max tyre is dropped, not assumed wide.
  const passesFilters = (r: MatrixRow) =>
    (!onlyWithinRadius || withinRadius(r)) &&
    (!wideTyresOnly || (r.tyreMax !== undefined && r.tyreMax >= 35)) &&
    (cockpitFilter === 'all' || r.cockpitType === cockpitFilter);

  const sorted = useMemo(() => {
    const filtered = rows.filter(passesFilters);
    return [...filtered].sort((a, b) => {
      if (sortKey === 'score') return b.score - a.score;
      if (sortKey === 'deltaReach') return Math.abs(a.deltaReach) - Math.abs(b.deltaReach);
      return Math.abs(a.deltaStack) - Math.abs(b.deltaStack);
    });
  }, [rows, onlyWithinRadius, wideTyresOnly, cockpitFilter, tol, sortKey]);

  const inRadiusCount = rows.filter(withinRadius).length;

  // Ten fit columns, plus four per open group. Used for the empty row's colSpan
  // and to decide whether the table still fits without sideways scrolling.
  const colCount = 10 + (showGeometry ? 4 : 0) + (showBuild ? 4 : 0);

  // The export carries exactly the columns the table shows, in the same order,
  // with the reference row first when there is one. Kept next to the <thead> so
  // the two cannot drift.
  const csvHeaders = [
    'Model', 'Size', 'Reference', 'Stack', 'Reach', 'ΔStack', 'ΔReach',
    'Required stem (mm)', 'Required spacers (mm)', 'Within tolerance',
    'Score', 'Verdict',
    ...(showGeometry
      ? ['Trail (mm)', 'Wheelbase (mm)', 'Chainstay (mm)', 'Max tyre (mm)']
      : []),
    ...(showBuild
      ? ['Adjust down (mm)', 'Adjust up (mm)', 'Cockpit type', 'Stock stem (mm)',
         'Stock stem angle (deg)', 'Stock spacers (mm)', 'Source URL']
      : []),
  ];
  const csvRow = (r: MatrixRow): ReadonlyArray<string | number> => [
    r.model, r.size, r.isReference ? 'yes' : 'no',
    r.stack.toFixed(0), r.reach.toFixed(0),
    r.deltaStack.toFixed(0), r.deltaReach.toFixed(0),
    r.requiredStem.toFixed(0), r.requiredSpacers.toFixed(0),
    r.isReference ? '' : (withinRadius(r) ? 'yes' : 'no'),
    Number.isNaN(r.score) ? '' : r.score.toFixed(1),
    r.verdict,
    ...(showGeometry ? [r.trail ?? '', r.wheelbase ?? '', r.chainstay ?? '', r.tyreMax ?? ''] : []),
    ...(showBuild
      ? [r.adjustDown.toFixed(0), r.adjustUp.toFixed(0), r.cockpitType ?? '',
         r.stockStem ?? '', r.stockStemAngle ?? '', r.stockSpacers ?? '', r.sourceUrl ?? '']
      : []),
  ];
  const exportCsv = () =>
    downloadCsv(
      `fit-matrix-${new Date().toISOString().slice(0, 10)}.csv`,
      csvHeaders,
      [...(referenceRow ? [referenceRow] : []), ...sorted].map(csvRow),
    );

  return (
    <div className="space-y-4">
      <div className="rounded-[10px] border border-[var(--border)] bg-[var(--panel)] p-4">
        {/* Only the prose collapses. The sliders are the control, not the
            explanation, and stay put either way. */}
        <Explainer
          title={`Fit tolerance — how far from ${referenceLabel} still counts as close`}
          storageKey="matrix-tolerance"
        >
          {anchorIsEstimated && (
            <p className="text-[11px] text-[var(--status-warning)]">
              No reference bike is on file, so the anchor is an estimated frame stack/reach derived
              from the target position with a typical head angle — narrower with a real reference bike.
            </p>
          )}
          <p className="mt-1 text-[11px] text-[var(--text-3)]">
            Shorter and longer in reach, lower and higher in stack are set separately — a frame that
            comes up short can be pulled back with a longer stem, one that runs long usually cannot.
          </p>
        </Explainer>
        <div className="mt-3 grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tol label="Reach — shorter" v={tol.xs} max={40} onChange={setField('xs')} />
          <Tol label="Reach — longer" v={tol.xl} max={40} onChange={setField('xl')} />
          <Tol label="Stack — lower" v={tol.yl} max={50} onChange={setField('yl')} />
          <Tol label="Stack — higher" v={tol.yh} max={50} onChange={setField('yh')} />
        </div>
        <div className="no-print mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={onlyWithinRadius} onChange={(e) => setOnlyWithinRadius(e.target.checked)} />
            Within tolerance only
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={wideTyresOnly} onChange={(e) => setWideTyresOnly(e.target.checked)} />
            35 mm tyres or wider
          </label>
          <label className="flex items-center gap-1.5">
            Cockpit
            <select
              value={cockpitFilter}
              onChange={(e) => setCockpitFilter(e.target.value as typeof cockpitFilter)}
              className="rounded border border-[var(--border)] bg-[var(--panel-2)] px-1.5 py-0.5"
            >
              <option value="all">any</option>
              <option value="open">open</option>
              <option value="semi-integrated">semi-integrated</option>
              <option value="integrated">integrated</option>
            </select>
          </label>
          <span className="text-[var(--text-3)]">
            {sorted.length} of {rows.length} sizes shown · {inRadiusCount} within tolerance
          </span>
          <button
            onClick={exportCsv}
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

      <div className="rounded-[10px] border border-[var(--border)] bg-[var(--panel)]">
        <div className="no-print flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-3 py-2 text-[11px]">
          <span className="text-[var(--text-3)]">Columns</span>
          <span className="rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-2 py-0.5 text-[var(--text-2)]">
            Fit
          </span>
          <ColumnToggle label="Handling &amp; tyres" on={showGeometry} onClick={() => setShowGeometry((v) => !v)} />
          <ColumnToggle label="Build &amp; source" on={showBuild} onClick={() => setShowBuild((v) => !v)} />
        </div>
        <div className="overflow-x-auto">
          <table className={`tabular w-full text-sm ${colCount > 12 ? 'min-w-[76rem]' : 'min-w-[46rem]'}`}>
            <thead className="bg-[var(--panel-2)] text-left text-[11px] uppercase tracking-wider text-[var(--text-3)]">
              <tr>
                <th className="sticky left-0 z-[2] bg-[var(--panel-2)] px-3 py-2">Model</th>
                <th className="px-2 py-2">Size</th>
                <th className="px-2 py-2 text-right">Stack</th>
                <th className="px-2 py-2 text-right">Reach</th>
                <SortableTh label="Δ Stack" active={sortKey === 'deltaStack'} onClick={() => setSortKey('deltaStack')} />
                <SortableTh label="Δ Reach" active={sortKey === 'deltaReach'} onClick={() => setSortKey('deltaReach')} />
                <th className="px-2 py-2 text-right">Stem</th>
                <th className="px-2 py-2 text-right">Spacers</th>
                <SortableTh label="Score" active={sortKey === 'score'} onClick={() => setSortKey('score')} />
                <th className="px-2 py-2">Radius</th>
                {showGeometry && (
                  <>
                    <th className="px-2 py-2 text-right">Trail</th>
                    <th className="px-2 py-2 text-right">Wheelbase</th>
                    <th className="px-2 py-2 text-right">Chainstay</th>
                    <th className="px-2 py-2 text-right">Max tyre</th>
                  </>
                )}
                {showBuild && (
                  <>
                    <th className="px-2 py-2">Adjustment left</th>
                    <th className="px-2 py-2">Cockpit</th>
                    <th className="px-2 py-2">Stock build</th>
                    <th className="px-2 py-2">Source</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {referenceRow && (
                <MatrixTr key="__reference" r={referenceRow} withinRadius={withinRadius}
                  showGeometry={showGeometry} showBuild={showBuild} />
              )}
              {sorted.map((r) => (
                <MatrixTr key={r.id} r={r} withinRadius={withinRadius}
                  showGeometry={showGeometry} showBuild={showBuild} />
              ))}
              {sorted.length === 0 && (
                <tr><td colSpan={colCount} className="px-3 py-6 text-center text-[var(--text-3)]">No catalogue sizes match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(showGeometry || showBuild) && (
        <p className="text-[11px] text-[var(--text-3)]">
          Trail, wheelbase, chainstay, max tyre, cockpit type and stock build are shown only where
          the manufacturer&rsquo;s table publishes them — a blank cell means
          &ldquo;not published&rdquo;, never an estimate.
          {showBuild && (
            <>
              {' '}<b>Adjustment left</b> is the vertical hood travel still available below (▼) and
              above (▲) the recommended build, moving spacers within the frame record&rsquo;s own
              limit (a standard 40&nbsp;mm unless the frame sets its own).
            </>
          )}
        </p>
      )}
    </div>
  );
}

const fmt = (v: number | undefined): string => (v === undefined ? '—' : v.toFixed(0));

function stockBuild(r: MatrixRow): string {
  if (r.stockStem === undefined && r.stockStemAngle === undefined && r.stockSpacers === undefined) {
    return '—';
  }
  const parts: string[] = [];
  if (r.stockStem !== undefined) parts.push(`${r.stockStem.toFixed(0)} mm`);
  if (r.stockStemAngle !== undefined) {
    parts.push(`${r.stockStemAngle > 0 ? '+' : ''}${r.stockStemAngle.toFixed(0)}°`);
  }
  if (r.stockSpacers !== undefined) parts.push(`${r.stockSpacers.toFixed(0)} mm sp.`);
  return parts.join(' / ');
}

/** Down/up spacer headroom as a split bar, scaled to the row's own total. */
function AdjustBar({ down, up }: { down: number; up: number }) {
  const total = down + up;
  if (total <= 0.5) return <span className="text-[11px] text-[var(--text-3)]">—</span>;
  const downPct = (down / total) * 100;
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={`${down.toFixed(0)} mm down · ${up.toFixed(0)} mm up`}
    >
      <span className="w-8 text-right text-[10px] tabular text-[var(--text-3)]">▼{down.toFixed(0)}</span>
      <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--status-good)_22%,transparent)]">
        <span className="absolute inset-y-0 left-0 bg-[var(--text-3)]" style={{ width: `${downPct}%` }} />
      </span>
      <span className="w-8 text-[10px] tabular text-[var(--text-3)]">▲{up.toFixed(0)}</span>
    </span>
  );
}

function MatrixTr({
  r, withinRadius, showGeometry, showBuild,
}: {
  r: MatrixRow;
  withinRadius: (r: MatrixRow) => boolean;
  showGeometry: boolean;
  showBuild: boolean;
}) {
  const inR = !r.isReference && withinRadius(r);
  const dim = !r.isReference && !inR;
  // The pinned Model cell has to paint over the columns sliding under it, so
  // every row needs a real background - `inherit` on the sticky cell then picks
  // up whichever one this row has.
  const rowBg = r.isReference
    ? 'color-mix(in srgb, var(--acc) 10%, var(--panel))'
    : 'var(--panel)';
  return (
    <tr
      className={`border-t border-[var(--border)] ${dim ? 'opacity-50' : ''}`}
      style={{ background: rowBg }}
    >
      <td className="sticky left-0 z-[1] px-3 py-2" style={{ background: 'inherit' }}>
        {r.model}
        {r.isReference && (
          <span className="ml-2 rounded-full bg-[color-mix(in_srgb,var(--acc)_20%,transparent)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--acc)]">
            ★ reference
          </span>
        )}
      </td>
      <td className="px-2 py-2 font-medium">{r.size}</td>
      <td className="px-2 py-2 text-right">{r.stack.toFixed(0)}</td>
      <td className="px-2 py-2 text-right">{r.reach.toFixed(0)}</td>
      <td className="px-2 py-2 text-right">{r.deltaStack >= 0 ? '+' : ''}{r.deltaStack.toFixed(0)}</td>
      <td className="px-2 py-2 text-right">{r.deltaReach >= 0 ? '+' : ''}{r.deltaReach.toFixed(0)}</td>
      <td className="px-2 py-2 text-right">{r.requiredStem.toFixed(0)}</td>
      <td className="px-2 py-2 text-right">{r.requiredSpacers.toFixed(0)}</td>
      <td className="px-2 py-2 text-right font-semibold">{Number.isNaN(r.score) ? '—' : r.score.toFixed(0)}</td>
      <td className="px-2 py-2">
        {r.isReference ? (
          <span className="text-[11px] text-[var(--text-3)]">anchor</span>
        ) : inR ? (
          <span className="rounded-full bg-[color-mix(in_srgb,var(--status-good)_16%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--status-good)]">
            ✓ in radius
          </span>
        ) : (
          <span className="text-[11px] text-[var(--text-3)]">outside</span>
        )}
      </td>
      {showGeometry && (
        <>
          <td className="px-2 py-2 text-right">{fmt(r.trail)}</td>
          <td className="px-2 py-2 text-right">{fmt(r.wheelbase)}</td>
          <td className="px-2 py-2 text-right">{fmt(r.chainstay)}</td>
          <td className="px-2 py-2 text-right">{fmt(r.tyreMax)}</td>
        </>
      )}
      {showBuild && (
        <>
          <td className="px-2 py-2">
            {r.isReference ? <span className="text-[11px] text-[var(--text-3)]">—</span> : <AdjustBar down={r.adjustDown} up={r.adjustUp} />}
          </td>
          <td className="px-2 py-2">{r.cockpitType ?? '—'}</td>
          <td className="px-2 py-2 whitespace-nowrap">{stockBuild(r)}</td>
          <td className="px-2 py-2">
            {r.sourceUrl ? (
              <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="text-[var(--acc)] hover:underline">
                source ↗
              </a>
            ) : (
              <span className="text-[var(--text-3)]">—</span>
            )}
          </td>
        </>
      )}
    </tr>
  );
}

/** One column-group chip. "Fit" has no chip - it is never hidden. */
function ColumnToggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-md border px-2 py-0.5 transition-colors ${
        on
          ? 'border-[var(--acc)] bg-[var(--panel-2)] text-[var(--foreground)]'
          : 'border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text-2)]'
      }`}
    >
      {label}
    </button>
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

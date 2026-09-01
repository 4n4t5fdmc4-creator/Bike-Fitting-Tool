'use client';

import { useMemo, useState } from 'react';
import { useStudio, type StoredFrame } from '@/state/studio';
import {
  detectOrientation, isSpecList, matchHeaderWithLegend, parseLegend, parseNumber, specListToRow,
  splitPaste, toSizeRows, type FieldKey,
} from '@/ingest/parse';

/** Plausibility gates, mirroring src/domain/validation.ts. */
const BOUNDS: Partial<Record<FieldKey, [number, number]>> = {
  stack: [400, 800], reach: [300, 500],
  headTubeAngle: [63, 80], seatTubeAngle: [65, 82],
};

type Draft = Omit<StoredFrame, 'id' | 'addedAt'>;

/** Fields a column can be assigned to by hand. */
const FIELD_OPTIONS: ReadonlyArray<FieldKey> = [
  'size', 'stack', 'reach', 'headTubeAngle', 'seatTubeAngle',
  'headTubeLength', 'seatTubeLength', 'chainstay', 'wheelbase',
  'bbDrop', 'forkRake', 'standover',
];

/**
 * Getting real geometry in.
 *
 * Automated retrieval was tried and does not work: manufacturers either block
 * automated requests, load their tables with JavaScript, or publish columns
 * labelled with letters keyed to a drawing. So the fitter copies the table and
 * pastes it — and nothing is saved until they have looked at every value.
 */
export function FramesPanel() {
  const frames = useStudio((s) => s.frames);
  const addFrame = useStudio((s) => s.addFrame);
  const addFrames = useStudio((s) => s.addFrames);
  const removeFrame = useStudio((s) => s.removeFrame);
  const [tab, setTab] = useState<'list' | 'manual' | 'paste'>('list');

  return (
    <section className="rounded-[10px] border border-[var(--border)] bg-[var(--panel)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-3)]">
          Your frames
        </h2>
        <span className="text-xs text-[var(--text-3)]">{frames.length} entered</span>
        <div className="ml-auto flex gap-1 rounded-md border border-[var(--border)] p-0.5 text-xs">
          {(['list', 'manual', 'paste'] as const).map((t) => (
            <button
              key={t} onClick={() => setTab(t)}
              className={`rounded px-2 py-1 ${tab === t ? 'bg-[var(--acc)] text-black font-semibold' : 'text-[var(--text-2)]'}`}
            >
              {t === 'list' ? 'List' : t === 'manual' ? 'Add one' : 'Paste a table'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'list' && <FrameList frames={frames} onRemove={removeFrame} />}
      {tab === 'manual' && <ManualForm onAdd={(d) => { addFrame(d); setTab('list'); }} />}
      {tab === 'paste' && <PasteImport onAdd={(ds) => { addFrames(ds); setTab('list'); }} />}
    </section>
  );
}

function FrameList({ frames, onRemove }: { frames: StoredFrame[]; onRemove: (id: string) => void }) {
  if (frames.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-[var(--text-2)]">
        No frames of your own yet. Recommendations currently run on the verified Pinarello F9 and
        X5 tables that ship with the tool. Add a frame by hand, or copy a geometry table from a
        manufacturer page and paste it — including the legend line if the columns are letters.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="tabular w-full min-w-[46rem] text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--text-3)]">
            <th className="px-4 py-2 font-semibold">Model</th>
            <th className="px-2 py-2 font-semibold">Size</th>
            <th className="px-2 py-2 text-right font-semibold">Stack</th>
            <th className="px-2 py-2 text-right font-semibold">Reach</th>
            <th className="px-2 py-2 text-right font-semibold">HTA</th>
            <th className="px-2 py-2 text-right font-semibold">STA</th>
            <th className="px-2 py-2 font-semibold">Source</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {frames.map((f) => (
            <tr key={f.id} className="border-t border-[var(--border)]">
              <td className="px-4 py-2">{f.model}</td>
              <td className="px-2 py-2">{f.size}</td>
              <td className="px-2 py-2 text-right">{f.stack}</td>
              <td className="px-2 py-2 text-right">{f.reach}</td>
              <td className="px-2 py-2 text-right">{f.headTubeAngle}°</td>
              <td className="px-2 py-2 text-right">{f.seatTubeAngle}°</td>
              <td className="px-2 py-2 text-xs text-[var(--text-3)]">
                {f.sourceUrl ? (
                  <a href={f.sourceUrl} target="_blank" rel="noreferrer" className="text-[var(--acc)] hover:underline">
                    {f.source} ↗
                  </a>
                ) : f.source}
              </td>
              <td className="px-2 py-2 text-right">
                <button onClick={() => onRemove(f.id)} className="text-xs text-[var(--text-3)] hover:text-[var(--status-critical)]">
                  remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const EMPTY: Draft = {
  model: '', size: '', stack: 570, reach: 385,
  headTubeAngle: 72, seatTubeAngle: 73.5, maxSpacerStack: 40,
  source: 'manual', sourceUrl: '',
};

function ManualForm({ onAdd }: { onAdd: (d: Draft) => void }) {
  const [d, setD] = useState<Draft>(EMPTY);
  const problems = checkBounds(d);
  const complete = d.model.trim() !== '' && d.size.trim() !== '';

  return (
    <div className="grid gap-3 p-4 sm:grid-cols-4">
      <Text label="Model" v={d.model} onChange={(v) => setD({ ...d, model: v })} placeholder="Pinarello Grevil F" />
      <Text label="Size" v={d.size} onChange={(v) => setD({ ...d, size: v })} placeholder="550" />
      <Num label="Stack" unit="mm" v={d.stack} onChange={(v) => setD({ ...d, stack: v })} />
      <Num label="Reach" unit="mm" v={d.reach} onChange={(v) => setD({ ...d, reach: v })} />
      <Num label="Head angle" unit="°" step={0.1} v={d.headTubeAngle} onChange={(v) => setD({ ...d, headTubeAngle: v })} />
      <Num label="Seat angle" unit="°" step={0.1} v={d.seatTubeAngle} onChange={(v) => setD({ ...d, seatTubeAngle: v })} />
      <Num label="Max spacers" unit="mm" v={d.maxSpacerStack} onChange={(v) => setD({ ...d, maxSpacerStack: v })} />
      <Text label="Source URL" v={d.sourceUrl} onChange={(v) => setD({ ...d, sourceUrl: v })} placeholder="https://…" />

      {problems.length > 0 && (
        <p className="rounded-md border border-[var(--status-warning)]/40 bg-[var(--status-warning)]/10 px-3 py-2 text-xs sm:col-span-4">
          <b>⚠ Outside the usual range:</b> {problems.join(' · ')}. Saving is still allowed — but
          check it against the table before you rely on it.
        </p>
      )}

      <div className="sm:col-span-4">
        <button
          disabled={!complete}
          onClick={() => { onAdd(d); setD(EMPTY); }}
          className="rounded-md bg-[var(--acc)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
        >
          Add frame
        </button>
        {!complete && <span className="ml-3 text-xs text-[var(--text-3)]">Model and size are required.</span>}
      </div>
    </div>
  );
}

function checkBounds(d: Draft): string[] {
  const out: string[] = [];
  const check = (k: FieldKey, v: number, label: string) => {
    const b = BOUNDS[k];
    if (b && (v < b[0] || v > b[1])) out.push(`${label} ${v} (expected ${b[0]}–${b[1]})`);
  };
  check('stack', d.stack, 'stack');
  check('reach', d.reach, 'reach');
  check('headTubeAngle', d.headTubeAngle, 'head angle');
  check('seatTubeAngle', d.seatTubeAngle, 'seat angle');
  return out;
}

function PasteImport({ onAdd }: { onAdd: (d: Draft[]) => void }) {
  const [text, setText] = useState('');
  const [model, setModel] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [legendText, setLegendText] = useState('');
  /**
   * Which column carries the size label. No heuristic can settle this: Pinarello
   * prints both CE (seat tube centre-to-end) and CC (centre-to-centre) and names
   * its sizes after CC, while other brands use neither. Auto-detected where
   * possible, always overridable, because getting it wrong silently relabels
   * every frame - a 550 imported as a 490.
   */
  const [sizeColumn, setSizeColumn] = useState<number | null>(null);
  /**
   * Per-column overrides. Chasing every brand's vocabulary does not scale -
   * Basso calls the head tube angle "Steering Tube Angle", the next brand will
   * call it something else again. So an unrecognised column is not a dead end:
   * the fitter assigns it, and the import proceeds.
   */
  const [overrides, setOverrides] = useState<Record<number, FieldKey | ''>>({});
  /** Only used for vertical spec lists, where the size lives outside the table. */
  const [manualSize, setManualSize] = useState('');

  const parsed = useMemo(() => {
    const table = splitPaste(text);
    if (!table) return null;

    // Three shapes in the wild: sizes across the top, sizes down the side, and a
    // vertical label/value list describing a single size.
    const specList = isSpecList(table);
    const orientation = specList ? ('specList' as const) : detectOrientation(table);
    const rows = specList
      ? specListToRow(table)
      : orientation === 'sizesAsColumns'
        ? toSizeRows(table)
        : table;
    // Several brands label columns with letters keyed to a drawing. Pasting the
    // legend alongside the table is what makes those readable.
    const legend = parseLegend(legendText);
    const mapping = rows.headers.map((h, i) => {
      const auto = matchHeaderWithLegend(h, legend);
      const override = overrides[i];
      if (override === undefined) return { header: h, ...auto };
      return override === ''
        ? { header: h, field: null, confidence: 0, method: 'none' as const }
        : { header: h, field: override, confidence: 1, method: 'exact' as const };
    });
    const drafts: Draft[] = rows.rows.map((r) => {
      const get = (f: FieldKey): number | null => {
        const i = mapping.findIndex((m) => m.field === f);
        return i >= 0 ? parseNumber(r[i] ?? '') : null;
      };
      const detected = mapping.findIndex((m) => m.field === 'size');
      const sizeIdx = sizeColumn ?? (detected >= 0 ? detected : 0);
      return {
        model, size: specList ? manualSize : (r[sizeIdx] ?? ''),
        stack: get('stack') ?? 0, reach: get('reach') ?? 0,
        headTubeAngle: get('headTubeAngle') ?? 0, seatTubeAngle: get('seatTubeAngle') ?? 0,
        maxSpacerStack: 40, source: 'pasted' as const, sourceUrl,
      };
    });
    return { orientation, specList, mapping, rows, drafts };
  }, [text, model, sourceUrl, legendText, sizeColumn, overrides, manualSize]);

  const usable = parsed?.drafts.filter((d) => checkBounds(d).length === 0 && d.size !== '') ?? [];
  const rejected = (parsed?.drafts.length ?? 0) - usable.length;
  /**
   * Two columns claiming the same field. Basso labels both the chainstay and
   * the front centre "Chain-Stay"; the first wins, which happens to be right
   * here and would not be elsewhere. Worth saying out loud rather than leaving
   * to luck.
   */
  const duplicates = parsed
    ? [...new Set(
        parsed.mapping
          .map((m) => m.field)
          .filter((f, i, all): f is FieldKey => f !== null && all.indexOf(f) !== i),
      )]
    : [];

  // Naming the missing field beats "0 rows imported" with no reason.
  const missing = parsed
    ? (['stack', 'reach', 'headTubeAngle', 'seatTubeAngle'] as const).filter(
        (f) => !parsed.mapping.some((m) => m.field === f),
      )
    : [];

  return (
    <div className="space-y-3 p-4">
      <p className="text-xs text-[var(--text-2)]">
        Select the geometry table on the manufacturer page, copy it, and paste it below. If the
        columns are letters, copy the legend line too — that is what makes them readable. Nothing is
        saved until you have looked at every value.
      </p>
      <details className="text-xs text-[var(--text-3)]">
        <summary className="cursor-pointer hover:text-[var(--foreground)]">
          What a paste looks like
        </summary>
        <pre className="mt-1.5 overflow-x-auto rounded-md bg-[var(--panel-2)] p-2 font-mono text-[11px] leading-relaxed">{`CE  CC  L   A[°]  B[°]  P   T   REACH  STACK
410 470 530 74.5  70.25 430 115 368.4  553.2
440 500 545 74    70.5  430 130 376.1  568.3`}</pre>
        <p className="mt-1.5">
          Legend: <code>A[°]: SEAT TUBE ANGLE, B[°]: HEADTUBE ANGLE, P: CHAINSTAY, T: HEADTUBE</code>
        </p>
        <p className="mt-1.5">
          Then set the size column — Pinarello names its sizes after CC, not CE, and no tool can
          guess that for you.
        </p>
      </details>
      <div className="grid gap-2 sm:grid-cols-2">
        <Text label="Model name" v={model} onChange={setModel} placeholder="Specialized Tarmac SL8" />
        <Text label="Source URL" v={sourceUrl} onChange={setSourceUrl} placeholder="https://…" />
      </div>
      <label className="block text-xs">
        <span className="text-[var(--text-2)]">
          Legend <span className="text-[var(--text-3)]">optional — needed when the columns are letters</span>
        </span>
        <textarea
          value={legendText} onChange={(e) => setLegendText(e.target.value)} rows={2}
          placeholder={'A[°]: SEAT TUBE ANGLE, B[°]: HEADTUBE ANGLE, P: CHAINSTAY, T: HEADTUBE, …'}
          className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-xs"
        />
      </label>
      <textarea
        value={text} onChange={(e) => setText(e.target.value)} rows={6}
        placeholder={'Size\t49\t52\t54\nStack\t509\t522\t535\nReach\t366\t375\t380\n…'}
        className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-xs"
      />

      {parsed && (
        <div className="space-y-2">
          <div>
            <p className="text-xs text-[var(--text-2)]">
              Read as{' '}
              <b>
                {parsed.orientation === 'specList'
                  ? 'a spec list for one size'
                  : parsed.orientation === 'sizesAsColumns'
                    ? 'sizes across the top'
                    : parsed.orientation === 'sizesAsRows'
                      ? 'sizes down the side'
                      : 'ambiguous — check carefully'}
              </b>
              . Anything unrecognised can be assigned by hand — no tool knows every brand's wording.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {parsed.mapping.map((m, i) => (
                <label
                  key={i}
                  className={`flex items-center gap-1 rounded-md border px-1.5 py-1 text-[11px] ${
                    m.field ? 'border-[var(--border)]' : 'border-[var(--status-warning)]/50'
                  }`}
                >
                  <span className="font-mono text-[var(--text-2)]">{m.header || `col ${i + 1}`}</span>
                  <span className="text-[var(--text-3)]">→</span>
                  <select
                    value={overrides[i] ?? m.field ?? ''}
                    onChange={(e) =>
                      setOverrides({ ...overrides, [i]: e.target.value as FieldKey | '' })
                    }
                    className="rounded border border-[var(--border)] bg-[var(--background)] px-1 py-0.5 text-[11px]"
                  >
                    <option value="">ignore</option>
                    {FIELD_OPTIONS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>

          {duplicates.length > 0 && (
            <p className="rounded-md border border-[var(--status-warning)]/40 bg-[var(--status-warning)]/10 px-3 py-2 text-xs">
              <b>⚠ Two columns claim {duplicates.join(' and ')}.</b> The left-most one is used.
              Check that it is the right one — some brands reuse a label for a different
              measurement — and set the other to <i>ignore</i> if not.
            </p>
          )}

          {parsed.specList ? (
            <label className="block text-xs">
              <span className="text-[var(--text-2)]">
                Size name{' '}
                <span className="text-[var(--text-3)]">
                  — this shape describes one size at a time, and the size is not in the table
                </span>
              </span>
              <input
                value={manualSize}
                onChange={(e) => setManualSize(e.target.value)}
                placeholder="e.g. 56"
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm sm:max-w-[12rem]"
              />
              <span className="mt-1 block text-[11px] text-[var(--text-3)]">
                Switch the size on the manufacturer page and paste again for each one.
              </span>
            </label>
          ) : (
          <label className="block text-xs">
            <span className="text-[var(--text-2)]">
              Size column{' '}
              <span className="text-[var(--text-3)]">
                — which column holds the size name the brand actually uses
              </span>
            </span>
            <select
              value={sizeColumn ?? ''}
              onChange={(e) => setSizeColumn(e.target.value === '' ? null : Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm sm:max-w-md"
            >
              <option value="">Auto — first column</option>
              {parsed.rows.headers.map((h, i) => (
                <option key={i} value={i}>
                  {h || `column ${i + 1}`} → {parsed.rows.rows.map((r) => r[i]).slice(0, 4).join(', ')}…
                </option>
              ))}
            </select>
          </label>
          )}

          <div className="overflow-x-auto rounded-md border border-[var(--border)]">
            <table className="tabular w-full min-w-[32rem] text-xs">
              <thead className="text-left text-[var(--text-3)]">
                <tr><th className="px-3 py-1.5">Size</th><th className="px-2 py-1.5 text-right">Stack</th>
                <th className="px-2 py-1.5 text-right">Reach</th><th className="px-2 py-1.5 text-right">HTA</th>
                <th className="px-2 py-1.5 text-right">STA</th><th className="px-2 py-1.5">Check</th></tr>
              </thead>
              <tbody>
                {parsed.drafts.map((d, i) => {
                  const p = checkBounds(d);
                  return (
                    <tr key={i} className="border-t border-[var(--border)]">
                      <td className="px-3 py-1.5">{d.size || '—'}</td>
                      <td className="px-2 py-1.5 text-right">{d.stack || '—'}</td>
                      <td className="px-2 py-1.5 text-right">{d.reach || '—'}</td>
                      <td className="px-2 py-1.5 text-right">{d.headTubeAngle || '—'}</td>
                      <td className="px-2 py-1.5 text-right">{d.seatTubeAngle || '—'}</td>
                      <td className={`px-2 py-1.5 ${p.length ? 'text-[var(--status-warning)]' : 'text-[var(--status-good)]'}`}>
                        {p.length ? `⚠ ${p[0]}` : '✓ plausible'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <button
            disabled={usable.length === 0 || model.trim() === ''}
            onClick={() => { onAdd(usable); setText(''); }}
            className="rounded-md bg-[var(--acc)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
          >
            Import {usable.length} frame{usable.length === 1 ? '' : 's'}
          </button>
          {rejected > 0 && (
            <span className="ml-3 text-xs text-[var(--text-3)]">
              {rejected} row{rejected === 1 ? '' : 's'} held back
              {missing.length > 0
                ? `: no column is mapped to ${missing.join(' or ')}. Assign it above.`
                : ' as implausible or incomplete.'}
            </span>
          )}
          {model.trim() === '' && <span className="ml-3 text-xs text-[var(--text-3)]">Enter a model name first.</span>}
        </div>
      )}
    </div>
  );
}

function Text({ label, v, onChange, placeholder }: { label: string; v: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block text-xs">
      <span className="text-[var(--text-2)]">{label}</span>
      <input
        value={v} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm"
      />
    </label>
  );
}

function Num({ label, unit, v, onChange, step = 1 }: { label: string; unit: string; v: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="block text-xs">
      <span className="text-[var(--text-2)]">{label} <span className="text-[var(--text-3)]">{unit}</span></span>
      <input
        type="number" value={v} step={step} onChange={(e) => onChange(Number(e.target.value))}
        className="tabular mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm"
      />
    </label>
  );
}

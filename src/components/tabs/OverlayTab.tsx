'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ModelRecommendation } from '@/engine/recommend';
import type { FrameEvaluation } from '@/engine/score';
import type { ReferenceBike } from '@/state/studio';
import { OVERLAY_CAP, useOverlaySelection } from '@/state/overlaySelection';
import { useComparisonMode } from '@/state/comparisonMode';
import { Range, Segmented } from '../controls';
import { FrameOverlay, type OverlayCandidate } from '../FrameOverlay';

/**
 * Colour follows the entity, not its rank (docs/app-architecture.md 5.5): a
 * candidate keeps its slot for the session even if another is toggled off and
 * back on, rather than being reassigned by array position.
 *
 * Four slots, all validated all-pairs, so colour alone separates them — the
 * head-tube labels the overlay draws are then reinforcement rather than the
 * only thing holding identity together.
 */
const PALETTE = [
  'var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)',
].slice(0, OVERLAY_CAP);

export function OverlayTab({
  models, referenceBike,
}: { models: ReadonlyArray<ModelRecommendation>; referenceBike: ReferenceBike | null }) {
  // The selection lives in a shared store so the Matrix scatter and the Accufit
  // tables work on the same frames. Slot assignment stays local - drawing only.
  const selected = useOverlaySelection((s) => s.selectedIds);
  const setSelected = useOverlaySelection((s) => s.setSelectedIds);
  const [slotOf, setSlotOf] = useState<Record<string, number>>({});

  // Every selected frame needs a colour slot. Assign any that lack one and keep
  // the slots already handed out, so a frame keeps its colour when another is
  // toggled off and back on. Covers both the initial seed and later toggles -
  // without this, a freshly seeded selection drew every line in slot 0's colour.
  useEffect(() => {
    setSlotOf((prev) => {
      const missing = selected.filter((id) => !(id in prev));
      if (missing.length === 0) return prev;
      const next = { ...prev };
      for (const id of missing) {
        const used = new Set(Object.values(next));
        next[id] = Array.from({ length: OVERLAY_CAP }, (_, i) => i).find((sl) => !used.has(sl)) ?? 0;
      }
      return next;
    });
  }, [selected]);

  // As-fitted / same-cockpit and the shared cockpit are in a store, so the
  // Matrix hood plot reads the exact same toggle and slider values.
  const fitMode = useComparisonMode((s) => s.fitMode);
  const setFitMode = useComparisonMode((s) => s.setFitMode);
  const cockpit = useComparisonMode((s) => s.cockpit);
  const setCockpit = useComparisonMode((s) => s.setCockpit);
  const seedCockpit = useComparisonMode((s) => s.seedCockpit);

  // Seed the shared cockpit from the reference bike (the position the fit was
  // measured at). Re-seeds on a client switch, leaves it alone once adjusted.
  useEffect(() => {
    seedCockpit(referenceBike?.label ?? 'none', {
      stemLength: referenceBike?.stemLength ?? 100,
      stemAngle: referenceBike?.stemAngle ?? -6,
      spacerHeight: referenceBike?.spacerHeight ?? 20,
      barReach: referenceBike?.barReach ?? 80,
      barRise: referenceBike?.barRise ?? 0,
    });
  }, [referenceBike, seedCockpit]);

  // Pruning invalid ids and seeding an empty selection is done once, in
  // Workspace, so the working set is the same no matter which tab mounts first.

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= OVERLAY_CAP) return prev;
      return [...prev, id];
    });
  };

  const bySize = useMemo(
    () => models.flatMap((m) => m.allSizes.map((s) => ({ model: m.model, ...s }))),
    [models],
  );

  // The bar the fit was measured on, carried onto every frame - a fit moves
  // between frames with its handlebar. Defaults where no reference bike is set.
  const bar = { reach: referenceBike?.barReach ?? 80, rise: referenceBike?.barRise ?? 0 };

  /** The build this frame needs to reach the target, for the chip and "as fitted". */
  const requiredBuild = (e: FrameEvaluation) => ({
    stemLength: Math.round(e.built.stemLength),
    stemAngle: Math.round(e.built.stemAngle),
    spacerStack: Math.round(e.built.spacerHeight),
    barReach: bar.reach,
    barRise: bar.rise,
  });

  const buildLabel = (b: ReturnType<typeof requiredBuild>) => {
    const sign = b.stemAngle < 0 ? '−' : '';
    return `${b.stemLength} / ${b.spacerStack} / ${sign}${Math.abs(b.stemAngle)}° · bar ${b.barReach}×${b.barRise}`;
  };

  const sharedCockpit = {
    stemLength: cockpit.stemLength, stemAngle: cockpit.stemAngle,
    spacerStack: cockpit.spacerHeight, barReach: cockpit.barReach, barRise: cockpit.barRise,
  };

  const chosen = selected
    .map((id) => bySize.find((s) => s.frame.id === id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined);

  const candidates: OverlayCandidate[] = chosen.map((s) => ({
    id: s.frame.id,
    label: `${s.model} ${s.frame.size}`,
    color: PALETTE[slotOf[s.frame.id] ?? 0] ?? PALETTE[0]!,
    frame: {
      stack: s.frame.stack, reach: s.frame.reach, headTubeAngle: s.frame.headTubeAngle,
      // Real value when the source data has it (all current sources do);
      // 73.5 is a last-resort fallback for a future source that lacks it.
      seatTubeAngle: s.frame.seatTubeAngle ?? 73.5,
      ...(s.frame.headTubeLength !== undefined ? { headTubeLength: s.frame.headTubeLength } : {}),
      ...(s.frame.chainstay !== undefined ? { chainstay: s.frame.chainstay } : {}),
      ...(s.frame.effectiveTopTube !== undefined ? { effectiveTopTube: s.frame.effectiveTopTube } : {}),
      ...(s.frame.wheelbase !== undefined ? { wheelbase: s.frame.wheelbase } : {}),
      ...(s.frame.bbDrop !== undefined ? { bbDrop: s.frame.bbDrop } : {}),
      ...(s.frame.tyreMax !== undefined ? { tyreMax: s.frame.tyreMax } : {}),
      // The cockpit is the toggle: each frame's own recommended build, or the
      // one shared cockpit currently on the sliders.
      ...(fitMode === 'same-cockpit' ? sharedCockpit : requiredBuild(s.evaluation)),
    },
  }));

  if (referenceBike) {
    // The reference keeps its real, measured cockpit under both modes - it is
    // the fixed bike the others are compared against, not a frame being re-built.
    candidates.push({
      id: '__reference',
      label: referenceBike.label,
      color: 'var(--text-3)',
      isReference: true,
      frame: {
        stack: referenceBike.stack, reach: referenceBike.reach,
        headTubeAngle: referenceBike.headTubeAngle, seatTubeAngle: 73.5,
        stemLength: referenceBike.stemLength, stemAngle: referenceBike.stemAngle,
        spacerStack: referenceBike.spacerHeight,
        barReach: referenceBike.barReach, barRise: referenceBike.barRise,
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[10px] border border-[var(--border)] bg-[var(--panel)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-3)]">
              Frames side by side
            </h3>
            <p className="mt-1 max-w-xl text-xs text-[var(--text-3)]">
              Up to {OVERLAY_CAP} candidates at once, plus the client’s own bike drawn dashed
              underneath. Every bottom bracket sits at the same point.
            </p>
          </div>
          <div className="no-print">
            <Segmented
              value={fitMode}
              onChange={setFitMode}
              options={[
                { value: 'as-fitted', label: 'As fitted' },
                { value: 'same-cockpit', label: 'Same cockpit' },
              ]}
            />
          </div>
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-3)]">
          {fitMode === 'as-fitted'
            ? 'As fitted: each bike carries the build the solver says it needs to hit the target — so what you compare is four finished bikes, not four frames. The sliders play no part in this mode.'
            : 'Same cockpit: every bike gets the one cockpit on the sliders below, so the only thing that differs between the drawings is the frame itself.'}
        </p>

        {fitMode === 'same-cockpit' && (
          <div className="no-print mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Range label="Stem" unit="mm" v={cockpit.stemLength} min={60} max={140} step={5} onChange={(v) => setCockpit({ stemLength: v })} />
            <Range label="Stem angle" unit="°" v={cockpit.stemAngle} min={-17} max={17} step={1} onChange={(v) => setCockpit({ stemAngle: v })} />
            <Range label="Spacers" unit="mm" v={cockpit.spacerHeight} min={0} max={50} step={2.5} onChange={(v) => setCockpit({ spacerHeight: v })} />
            <Range label="Bar reach" unit="mm" v={cockpit.barReach} min={65} max={100} step={1} onChange={(v) => setCockpit({ barReach: v })} />
            <Range label="Bar rise" unit="mm" v={cockpit.barRise} min={0} max={40} step={1} onChange={(v) => setCockpit({ barRise: v })} />
          </div>
        )}

        <FramePicker
          models={models}
          selected={selected}
          slotOf={slotOf}
          onToggle={toggle}
          label={(e) => buildLabel(requiredBuild(e))}
        />
      </div>

      <FrameOverlay candidates={candidates} />

      {/* The chips carry the required build on screen, and the chips are not
          printed. Without this the printout showed a drawing and four names -
          everything the client needed to take to a shop was missing. */}
      {chosen.length > 0 && (
        <table className="print-only w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--border)] text-left">
              <th className="py-1 pr-3 font-medium">Frame</th>
              <th className="py-1 pr-3 font-medium">Stem</th>
              <th className="py-1 pr-3 font-medium">Angle</th>
              <th className="py-1 pr-3 font-medium">Spacers</th>
              <th className="py-1 pr-3 font-medium">Bar</th>
            </tr>
          </thead>
          <tbody>
            {chosen.map((s) => {
              const b = fitMode === 'same-cockpit' ? sharedCockpit : requiredBuild(s.evaluation);
              return (
                <tr key={s.frame.id} className="border-b border-[var(--border)]/50">
                  <td className="py-1 pr-3">{s.model} {s.frame.size}</td>
                  <td className="tabular py-1 pr-3">{b.stemLength} mm</td>
                  <td className="tabular py-1 pr-3">{b.stemAngle > 0 ? '+' : ''}{b.stemAngle}°</td>
                  <td className="tabular py-1 pr-3">{b.spacerStack} mm</td>
                  <td className="tabular py-1 pr-3">{b.barReach}×{b.barRise}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

/**
 * One chip per MODEL, showing its recommended size — not one chip per size of
 * every model.
 *
 * The flat list offered forty-odd chips, which is every row of every geometry
 * table the fitter had pasted. That is the raw data, not a choice: nobody is
 * deciding between a 47 and a 61. The recommended size is the chip; the other
 * sizes are one click away per model, because the genuinely useful comparison —
 * two adjacent sizes of the same bike — still has to be reachable.
 */
function FramePicker({
  models, selected, slotOf, onToggle, label,
}: {
  models: ReadonlyArray<ModelRecommendation>;
  selected: ReadonlyArray<string>;
  slotOf: Record<string, number>;
  onToggle: (id: string) => void;
  label: (e: FrameEvaluation) => string;
}) {
  const [openModel, setOpenModel] = useState<string | null>(null);
  const full = selected.length >= OVERLAY_CAP;

  const chip = (
    id: string, name: string, sub: string | null, isRecommended: boolean,
  ) => {
    const isOn = selected.includes(id);
    const color = isOn ? (PALETTE[slotOf[id] ?? 0] ?? PALETTE[0]!) : undefined;
    return (
      <button
        key={id}
        onClick={() => onToggle(id)}
        disabled={!isOn && full}
        title={!isOn && full ? `Deselect one first — ${OVERLAY_CAP} at a time` : undefined}
        className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs disabled:opacity-30"
        style={{ borderColor: isOn ? color : 'var(--border)' }}
      >
        {isOn && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />}
        <span className={isRecommended ? 'font-medium' : undefined}>{name}</span>
        {sub && <span className="tabular text-[var(--text-3)]">{sub}</span>}
      </button>
    );
  };

  return (
    <div className="no-print mt-3 space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] text-[var(--text-3)]">
          Recommended size per model. {selected.length} of {OVERLAY_CAP} slots used.
        </span>
      </div>

      {models.map((m) => {
        const open = openModel === m.model;
        const others = m.allSizes.filter((s) => s.frame.id !== m.best.frame.id);
        return (
          <div key={m.model} className="flex flex-wrap items-center gap-1.5">
            {chip(
              m.best.frame.id,
              `${m.model} ${m.best.frame.size}`,
              selected.includes(m.best.frame.id) ? label(m.best.evaluation) : null,
              true,
            )}
            {m.closeCall && m.alternative && (
              <span className="text-[11px] text-[var(--text-3)]">
                close call with {m.alternative.frame.size}
              </span>
            )}
            {others.length > 0 && (
              <button
                onClick={() => setOpenModel(open ? null : m.model)}
                className="rounded-md px-1.5 py-1 text-[11px] text-[var(--text-3)] hover:text-[var(--text-2)]"
              >
                {open ? '− other sizes' : `+ ${others.length} other size${others.length === 1 ? '' : 's'}`}
              </button>
            )}
            {open &&
              others.map((s) =>
                chip(
                  s.frame.id,
                  s.frame.size,
                  selected.includes(s.frame.id) ? label(s.evaluation) : null,
                  false,
                ),
              )}
          </div>
        );
      })}
    </div>
  );
}

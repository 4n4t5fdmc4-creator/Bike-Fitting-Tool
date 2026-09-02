'use client';

import { useEffect, useState } from 'react';
import type { ModelRecommendation } from '@/engine/recommend';
import type { FrameEvaluation } from '@/engine/score';
import type { ReferenceBike } from '@/state/studio';
import { useOverlaySelection } from '@/state/overlaySelection';
import { useComparisonMode } from '@/state/comparisonMode';
import { Range, Segmented } from '../controls';
import { FrameOverlay, type OverlayAlign, type OverlayCandidate } from '../FrameOverlay';

/**
 * Colour follows the entity, not its rank (docs/app-architecture.md 5.5): a
 * candidate keeps its slot for the session even if another is toggled off and
 * back on, rather than being reassigned by array position.
 *
 * Eight slots, not three. Slots 1-3 are validated all-pairs and separable by
 * colour alone; 4-8 lean on the direct label at each frame's head tube, which
 * the overlay always draws. See docs/app-architecture.md section 6.4.
 */
const PALETTE = [
  'var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)',
  'var(--series-5)', 'var(--series-6)', 'var(--series-7)', 'var(--series-8)',
];
const CAP = PALETTE.length;

export function OverlayTab({
  models, referenceBike,
}: { models: ReadonlyArray<ModelRecommendation>; referenceBike: ReferenceBike | null }) {
  // The selection lives in a shared store so the Matrix scatter can label the
  // same frames. Slot assignment stays local - it is only a drawing concern.
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
        next[id] = Array.from({ length: CAP }, (_, i) => i).find((sl) => !used.has(sl)) ?? 0;
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

  const [align, setAlign] = useState<OverlayAlign>('bb');

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
      if (prev.length >= CAP) return prev;
      return [...prev, id];
    });
  };

  const bySize = models.flatMap((m) => m.allSizes.map((s) => ({ model: m.model, ...s })));

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

  const candidates: OverlayCandidate[] = selected
    .map((id) => bySize.find((s) => s.frame.id === id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined)
    .map((s) => ({
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

  const chips = [...bySize].sort(
    (a, b) => a.model.localeCompare(b.model) || sizeValue(a.frame.size) - sizeValue(b.frame.size),
  );

  return (
    <div className="space-y-4">
      <div className="rounded-[10px] border border-[var(--border)] bg-[var(--panel)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-3)]">
              Overlay up to eight frames
            </h3>
            <p className="mt-1 text-xs text-[var(--text-3)]">
              Three colours are cleanly distinguishable; past that, each frame is named at its head
              tube, so identity never rests on colour alone.
            </p>
          </div>
          <div className="no-print flex flex-col gap-2">
            <Segmented
              value={fitMode}
              onChange={setFitMode}
              options={[
                { value: 'as-fitted', label: 'As fitted' },
                { value: 'same-cockpit', label: 'Same cockpit' },
              ]}
            />
            <Segmented
              value={align}
              onChange={setAlign}
              options={[
                { value: 'bb', label: 'Align at BB' },
                { value: 'hoods', label: 'Align at hoods' },
              ]}
            />
          </div>
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-3)]">
          {fitMode === 'as-fitted'
            ? 'As fitted: each bike drawn with its own recommended build, so finished bikes are compared. '
            : 'Same cockpit: every bike gets the cockpit on the sliders below, so only the frames differ. '}
          {align === 'hoods'
            ? 'Aligned at the hoods — same hand position, different bike.'
            : 'Aligned at the bottom bracket — raw frame reach and stack.'}
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

        <div className="no-print mt-3 flex flex-wrap gap-1.5">
          {chips.map((s) => {
            const id = s.frame.id;
            const isOn = selected.includes(id);
            const color = isOn ? (PALETTE[slotOf[id] ?? 0] ?? PALETTE[0]!) : undefined;
            return (
              <button
                key={id}
                onClick={() => toggle(id)}
                disabled={!isOn && selected.length >= CAP}
                className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs disabled:opacity-30"
                style={{ borderColor: isOn ? color : 'var(--border)' }}
              >
                {isOn && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />}
                <span>{s.model} {s.frame.size}</span>
                {isOn && (
                  <span className="tabular text-[var(--text-3)]">
                    {buildLabel(requiredBuild(s.evaluation))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <FrameOverlay candidates={candidates} align={align} />
    </div>
  );
}

/** Numeric lead of a size label ("56", "550", "XS" -> 0) for a stable chip order. */
function sizeValue(size: string): number {
  const n = parseFloat(size);
  return Number.isFinite(n) ? n : 0;
}

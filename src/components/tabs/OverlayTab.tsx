'use client';

import { useEffect, useState } from 'react';
import type { ModelRecommendation } from '@/engine/recommend';
import type { FrameEvaluation } from '@/engine/score';
import type { ReferenceBike } from '@/state/studio';
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

/** What build to draw on each frame. */
type FitMode = 'as-fitted' | 'same-cockpit';

export function OverlayTab({
  models, referenceBike,
}: { models: ReadonlyArray<ModelRecommendation>; referenceBike: ReferenceBike | null }) {
  const initialIds = () => models.slice(0, 3).map((m) => m.best.frame.id);
  const [selected, setSelected] = useState<string[]>(initialIds);
  // Slots must be assigned at the same moment as the initial selection - a
  // colour assigned only inside toggle() left every pre-selected frame
  // defaulting to slot 0, so all the lines rendered in the same colour.
  const [slotOf, setSlotOf] = useState<Record<string, number>>(() =>
    Object.fromEntries(initialIds().map((id, i) => [id, i])),
  );

  const [fitMode, setFitMode] = useState<FitMode>('as-fitted');
  const [align, setAlign] = useState<OverlayAlign>('bb');

  // The shared cockpit for "same cockpit" mode. Seeded from the reference bike
  // when there is one, so the default is the position the fit was measured at.
  const [stem, setStem] = useState(referenceBike?.stemLength ?? 100);
  const [stemAngle, setStemAngle] = useState(referenceBike?.stemAngle ?? -6);
  const [spacers, setSpacers] = useState(referenceBike?.spacerHeight ?? 20);
  const [barReach, setBarReach] = useState(referenceBike?.barReach ?? 80);
  const [barRise, setBarRise] = useState(referenceBike?.barRise ?? 0);

  useEffect(() => {
    // Only prune ids that no longer exist (e.g. a frame was deleted); never
    // reset the selection just because the model list re-rendered.
    setSelected((prev) => {
      const valid = new Set(models.flatMap((m) => m.allSizes.map((s) => s.frame.id)));
      const kept = prev.filter((id) => valid.has(id));
      return kept.length > 0 ? kept : models.slice(0, 3).map((m) => m.best.frame.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models.length]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= CAP) return prev;
      return [...prev, id];
    });
    setSlotOf((prev) => {
      if (id in prev) return prev;
      const used = new Set(Object.values(prev));
      const free = Array.from({ length: CAP }, (_, i) => i).find((s) => !used.has(s)) ?? 0;
      return { ...prev, [id]: free };
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
    stemLength: stem, stemAngle, spacerStack: spacers, barReach, barRise,
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
          <div className="flex flex-col gap-2">
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
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Range label="Stem" unit="mm" v={stem} min={60} max={140} step={5} onChange={setStem} />
            <Range label="Stem angle" unit="°" v={stemAngle} min={-17} max={17} step={1} onChange={setStemAngle} />
            <Range label="Spacers" unit="mm" v={spacers} min={0} max={50} step={2.5} onChange={setSpacers} />
            <Range label="Bar reach" unit="mm" v={barReach} min={65} max={100} step={1} onChange={setBarReach} />
            <Range label="Bar rise" unit="mm" v={barRise} min={0} max={40} step={1} onChange={setBarRise} />
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
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

function Segmented<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<{ value: T; label: string }>;
}) {
  return (
    <div className="inline-flex rounded-md border border-[var(--border)] p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded px-2 py-1 transition-colors ${
            value === o.value
              ? 'bg-[var(--panel-2)] font-semibold text-[var(--foreground)]'
              : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const roundToStep = (v: number, step: number) => Math.round(v / step) * step;

function Range({
  label, unit, v, min, max, step, onChange,
}: {
  label: string; unit: string; v: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-xs">
      <span className="flex items-baseline justify-between">
        <span className="text-[var(--text-2)]">{label}</span>
        <span className="tabular font-semibold">{roundToStep(v, step)} {unit}</span>
      </span>
      <input
        type="range" min={min} max={max} step={step} value={v}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-[var(--acc)]"
      />
    </label>
  );
}

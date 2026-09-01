'use client';

import { useEffect, useState } from 'react';
import type { ModelRecommendation } from '@/engine/recommend';
import type { ReferenceBike } from '@/state/studio';
import { FrameOverlay, type OverlayCandidate } from '../FrameOverlay';

/**
 * Colour follows the entity, not its rank (docs/app-architecture.md 5.5): a
 * candidate keeps its slot for the session even if another is toggled off and
 * back on, rather than being reassigned by array position.
 */
const SLOTS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];

export function OverlayTab({
  models, referenceBike,
}: { models: ReadonlyArray<ModelRecommendation>; referenceBike: ReferenceBike | null }) {
  const initialIds = () => models.slice(0, 3).map((m) => m.best.frame.id);
  const [selected, setSelected] = useState<string[]>(initialIds);
  // Slots must be assigned at the same moment as the initial selection - a
  // colour assigned only inside toggle() left every pre-selected frame
  // defaulting to slot 0, so all three lines rendered in the same colour.
  const [slotOf, setSlotOf] = useState<Record<string, number>>(() =>
    Object.fromEntries(initialIds().map((id, i) => [id, i])),
  );

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
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
    setSlotOf((prev) => {
      if (id in prev) return prev;
      const used = new Set(Object.values(prev));
      const free = [0, 1, 2].find((s) => !used.has(s)) ?? 0;
      return { ...prev, [id]: free };
    });
  };

  const bySize = models.flatMap((m) => m.allSizes.map((s) => ({ model: m.model, ...s })));

  const candidates: OverlayCandidate[] = selected
    .map((id) => bySize.find((s) => s.frame.id === id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined)
    .map((s) => ({
      id: s.frame.id,
      label: `${s.model} ${s.frame.size}`,
      color: SLOTS[(slotOf[s.frame.id] ?? 0) % SLOTS.length] ?? SLOTS[0]!,
      frame: {
        stack: s.frame.stack, reach: s.frame.reach, headTubeAngle: s.frame.headTubeAngle,
        // Real value when the source data has it (all current sources do);
        // 73.5 is a last-resort fallback for a future source that lacks it.
        seatTubeAngle: s.frame.seatTubeAngle ?? 73.5,
      },
    }));

  if (referenceBike) {
    candidates.push({
      id: '__reference',
      label: `${referenceBike.label} (reference)`,
      color: 'var(--text-3)',
      frame: {
        stack: referenceBike.stack, reach: referenceBike.reach,
        headTubeAngle: referenceBike.headTubeAngle, seatTubeAngle: 73.5,
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[10px] border border-[var(--border)] bg-[var(--panel)] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-3)]">
          Pick up to three frames to overlay
        </h3>
        <p className="mt-1 text-xs text-[var(--text-3)]">
          Capped at three: beyond that, colours stop being reliably distinguishable — verified with
          the palette validator, not eyeballed.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {models.map((m) => {
            const id = m.best.frame.id;
            const isOn = selected.includes(id);
            const color = isOn ? SLOTS[(slotOf[id] ?? 0) % SLOTS.length] : undefined;
            return (
              <button
                key={id}
                onClick={() => toggle(id)}
                disabled={!isOn && selected.length >= 3}
                className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs disabled:opacity-30"
                style={{ borderColor: isOn ? color : 'var(--border)' }}
              >
                {isOn && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
                {m.model} {m.best.frame.size}
              </button>
            );
          })}
        </div>
      </div>

      <FrameOverlay candidates={candidates} />
    </div>
  );
}

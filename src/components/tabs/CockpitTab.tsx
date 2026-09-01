'use client';

import { useMemo, useState } from 'react';
import type { ModelRecommendation } from '@/engine/recommend';
import type { BbPoint } from '@/domain/units';
import type { ReferenceBike } from '@/state/studio';
import { CockpitExplorer } from '../CockpitExplorer';

export function CockpitTab({
  models, target, referenceBike,
}: {
  models: ReadonlyArray<ModelRecommendation>;
  target: BbPoint | null;
  referenceBike: ReferenceBike | null;
}) {
  const flat = useMemo(
    () => models.flatMap((m) => m.allSizes.map((s) => ({ model: m.model, ...s }))),
    [models],
  );
  const [selectedId, setSelectedId] = useState<string | null>(flat[0]?.frame.id ?? null);
  const selected = flat.find((s) => s.frame.id === selectedId) ?? flat[0];

  if (!selected) {
    return (
      <p className="rounded-[10px] border border-dashed border-[var(--border)] bg-[var(--panel)] px-4 py-8 text-center text-sm text-[var(--text-3)]">
        Add a frame in the Bikes tab first.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <label className="block text-xs">
        <span className="text-[var(--text-2)]">Frame</span>
        <select
          value={selected.frame.id}
          onChange={(e) => setSelectedId(e.target.value)}
          className="mt-1 w-full max-w-sm rounded-md border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 text-sm"
        >
          {flat.map((s) => (
            <option key={s.frame.id} value={s.frame.id}>
              {s.model} {s.frame.size} — score {s.evaluation.composite.toFixed(0)}
            </option>
          ))}
        </select>
      </label>

      <p className="text-xs text-[var(--text-3)]">
        Starts at the recommended build. Drag anything — the position updates live, computed exactly
        by the engine and rounded only for display, to whole millimetres.
      </p>

      <CockpitExplorer
        key={selected.frame.id}
        frame={{
          stack: selected.frame.stack, reach: selected.frame.reach,
          headTubeAngle: selected.frame.headTubeAngle, maxSpacerStack: selected.frame.maxSpacerStack,
        }}
        target={target}
        initialStem={Math.round(selected.evaluation.built.stemLength / 5) * 5}
        initialAngle={selected.evaluation.built.stemAngle}
        initialSpacers={Math.round(selected.evaluation.built.spacerHeight / 2.5) * 2.5}
        initialBarReach={referenceBike?.barReach ?? 80}
        initialBarRise={referenceBike?.barRise ?? 0}
      />
    </div>
  );
}

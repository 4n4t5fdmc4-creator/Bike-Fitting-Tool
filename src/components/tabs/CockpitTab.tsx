'use client';

import type { ModelRecommendation } from '@/engine/recommend';
import type { BbPoint } from '@/domain/units';
import type { ReferenceBike } from '@/state/studio';
import { CockpitDuel } from '../CockpitDuel';

export function CockpitTab({
  models, target, referenceBike,
}: {
  models: ReadonlyArray<ModelRecommendation>;
  target: BbPoint | null;
  referenceBike: ReferenceBike | null;
}) {
  const hasFrames = models.some((m) => m.allSizes.length > 0);

  if (!hasFrames) {
    return (
      <p className="rounded-[10px] border border-dashed border-[var(--border)] bg-[var(--panel)] px-4 py-8 text-center text-sm text-[var(--text-3)]">
        Add a frame in the Bikes tab first.
      </p>
    );
  }

  return <CockpitDuel models={models} target={target} referenceBike={referenceBike} />;
}

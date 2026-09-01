'use client';

import type { ModelRecommendation } from '@/engine/recommend';
import { MatrixTab, type MatrixRow } from '../MatrixTab';

export function MatrixTabWrapper({
  models, anchor, referenceLabel, anchorIsEstimated,
}: {
  models: ReadonlyArray<ModelRecommendation>;
  anchor: { stack: number; reach: number };
  referenceLabel: string;
  anchorIsEstimated: boolean;
}) {
  const rows: MatrixRow[] = models.flatMap((m) =>
    m.allSizes.map((s) => ({
      id: s.frame.id,
      model: m.model,
      size: s.frame.size,
      stack: s.frame.stack,
      reach: s.frame.reach,
      deltaStack: s.frame.stack - anchor.stack,
      deltaReach: s.frame.reach - anchor.reach,
      requiredStem: s.evaluation.required.stemLength,
      requiredSpacers: s.evaluation.required.spacerHeight,
      score: s.evaluation.composite,
      verdict: s.evaluation.verdict,
    })),
  );

  if (rows.length === 0) {
    return (
      <p className="rounded-[10px] border border-dashed border-[var(--border)] bg-[var(--panel)] px-4 py-8 text-center text-sm text-[var(--text-3)]">
        Add a frame in the Bikes tab first.
      </p>
    );
  }

  return <MatrixTab rows={rows} referenceLabel={referenceLabel} anchorIsEstimated={anchorIsEstimated} />;
}

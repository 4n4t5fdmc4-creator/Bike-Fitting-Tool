'use client';

import { useMemo } from 'react';
import { deg, mm } from '@/domain/units';
import { resolveCockpit } from '@/engine/assumptions';
import { gripPoint, type FrameCore } from '@/engine/forward';
import type { ModelRecommendation } from '@/engine/recommend';
import type { ReferenceBike } from '@/state/studio';
import { useComparisonMode } from '@/state/comparisonMode';
import { MatrixTab, type HoodRow, type MatrixRow } from '../MatrixTab';

export function MatrixTabWrapper({
  models, anchor, referenceLabel, anchorIsEstimated, targetGrip, referenceBike,
}: {
  models: ReadonlyArray<ModelRecommendation>;
  anchor: { stack: number; reach: number };
  referenceLabel: string;
  anchorIsEstimated: boolean;
  /** The reference hood position (BB-relative), centre of the target window. */
  targetGrip: { x: number; y: number } | null;
  /** Set only when the client's own bike defines the target. */
  referenceBike: ReferenceBike | null;
}) {
  const cockpit = useComparisonMode((s) => s.cockpit);

  const resolvedShared = useMemo(
    () => resolveCockpit({
      stemLength: mm(cockpit.stemLength),
      stemAngle: deg(cockpit.stemAngle),
      spacerHeight: mm(cockpit.spacerHeight),
      barReach: mm(cockpit.barReach),
      barRise: mm(cockpit.barRise),
    }),
    [cockpit],
  );

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

  // Where the hands land: the recommended build's achieved grip, and where the
  // shared-cockpit build would put them. Both BB-relative.
  const hoodRows: HoodRow[] = useMemo(
    () => models.flatMap((m) =>
      m.allSizes.map((s) => {
        const core: FrameCore = {
          stack: s.frame.stack, reach: s.frame.reach, headTubeAngle: s.frame.headTubeAngle,
        };
        const sc = gripPoint(core, resolvedShared);
        return {
          id: s.frame.id, model: m.model, size: s.frame.size,
          asFitted: { x: s.evaluation.achieved.x, y: s.evaluation.achieved.y },
          sameCockpit: { x: sc.x, y: sc.y },
        };
      }),
    ),
    [models, resolvedShared],
  );

  const referenceGrip = useMemo(
    () => targetGrip ?? { x: anchor.reach, y: anchor.stack },
    [targetGrip, anchor.reach, anchor.stack],
  );

  const referenceHood = useMemo(() => {
    if (!referenceBike) return null;
    const p = gripPoint(
      {
        stack: mm(referenceBike.stack),
        reach: mm(referenceBike.reach),
        headTubeAngle: deg(referenceBike.headTubeAngle),
      },
      resolvedShared,
    );
    // "As fitted" is the measured position - which is exactly the target grip.
    return { asFitted: referenceGrip, sameCockpit: { x: p.x, y: p.y } };
  }, [referenceBike, resolvedShared, referenceGrip]);

  if (rows.length === 0) {
    return (
      <p className="rounded-[10px] border border-dashed border-[var(--border)] bg-[var(--panel)] px-4 py-8 text-center text-sm text-[var(--text-3)]">
        Add a frame in the Bikes tab first.
      </p>
    );
  }

  return (
    <MatrixTab
      rows={rows}
      anchor={anchor}
      referenceLabel={referenceLabel}
      anchorIsEstimated={anchorIsEstimated}
      hoodRows={hoodRows}
      referenceGrip={referenceGrip}
      referenceHood={referenceHood}
    />
  );
}

'use client';

import { useMemo } from 'react';
import { deg, mm, toRad } from '@/domain/units';
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
    m.allSizes.map((s) => {
      // Spacer room still available on either side of the recommended build,
      // expressed as vertical travel at the hoods (spacer mm x sin(head angle)).
      // The limit is the frame record's own maxSpacerStack - a standard 40 mm
      // steerer allowance unless the fitter set a different one.
      const limit = s.frame.maxSpacerStack;
      const atBuild = Math.min(Math.max(s.evaluation.built.spacerHeight, 0), limit);
      const vFactor = Math.sin(toRad(s.frame.headTubeAngle));
      return {
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
        trail: s.frame.trail,
        wheelbase: s.frame.wheelbase,
        chainstay: s.frame.chainstay,
        tyreMax: s.frame.tyreMax,
        cockpitType: s.frame.cockpitType,
        stockStem: s.frame.stockStem,
        stockStemAngle: s.frame.stockStemAngle,
        stockSpacers: s.frame.stockSpacers,
        sourceUrl: s.frame.sourceUrl,
        adjustDown: atBuild * vFactor,
        adjustUp: (limit - atBuild) * vFactor,
      } satisfies MatrixRow;
    }),
  );

  // The client's own bike, pinned to the top of the table and marked. Its
  // stack/reach ARE the anchor when it is on file, so the deltas are zero.
  const referenceRow: MatrixRow | null = useMemo(() => {
    if (!referenceBike) return null;
    return {
      id: '__reference',
      model: referenceBike.label || 'Reference bike',
      size: '—',
      stack: mm(referenceBike.stack),
      reach: mm(referenceBike.reach),
      deltaStack: 0,
      deltaReach: 0,
      requiredStem: mm(referenceBike.stemLength),
      requiredSpacers: mm(referenceBike.spacerHeight),
      score: NaN,
      verdict: '—',
      stockStem: mm(referenceBike.stemLength),
      stockStemAngle: deg(referenceBike.stemAngle),
      stockSpacers: mm(referenceBike.spacerHeight),
      isReference: true,
      adjustDown: 0,
      adjustUp: 0,
    } satisfies MatrixRow;
  }, [referenceBike]);

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
      referenceRow={referenceRow}
      anchor={anchor}
      referenceLabel={referenceLabel}
      anchorIsEstimated={anchorIsEstimated}
      hoodRows={hoodRows}
      referenceGrip={referenceGrip}
      referenceHood={referenceHood}
    />
  );
}

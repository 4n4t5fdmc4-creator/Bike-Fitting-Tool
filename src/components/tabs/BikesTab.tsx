'use client';

import type { Client } from '@/state/studio';
import type { DerivedTarget } from '@/engine/target';
import type { ModelRecommendation } from '@/engine/recommend';
import { ReferenceBikePanel } from '../ReferenceBikePanel';
import { FramesPanel } from '../FramesPanel';
import { ModelCard } from '../ModelCard';
import { StatRow } from '../StatRow';

export function BikesTab({
  client, target, models, usingExamples, catalogueCount, referenceLabel,
}: {
  client: Client;
  target: DerivedTarget | null;
  models: ReadonlyArray<ModelRecommendation>;
  usingExamples: boolean;
  catalogueCount: number;
  referenceLabel: string;
}) {
  const excellent = models.filter((m) => m.best.evaluation.verdict === 'excellentFit').length;

  return (
    <div className="space-y-6">
      <ReferenceBikePanel client={client} />

      {target && (
        <StatRow
          target={target}
          fitting={excellent}
          total={models.length}
          measured={client.targetMode === 'reference' && client.referenceBike !== null}
        />
      )}

      <FramesPanel />

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--text-3)]">
            Frames that would be worth considering
          </h2>
          <span className="text-xs text-[var(--text-3)]">
            {usingExamples
              ? `${catalogueCount} verified sizes from Pinarello — add your own above`
              : `${catalogueCount} sizes you entered`}
          </span>
        </div>

        <p className="mt-2 text-sm text-[var(--text-2)]">
          {excellent > 0 ? (
            <><b className="text-[var(--foreground)]">{excellent}</b> of {models.length} models can be
            built to this exact position.</>
          ) : (
            <><b className="text-[var(--foreground)]">None of these models reaches this position with
            ordinary parts.</b> Closest first, each with what it would take.</>
          )}
        </p>

        <ul className="mt-3 space-y-2">
          {models.map((m) => (
            <ModelCard key={m.model} rec={m} referenceLabel={referenceLabel} />
          ))}
        </ul>

        {models.length === 0 && (
          <p className="mt-3 rounded-[10px] border border-dashed border-[var(--border)] bg-[var(--panel)] px-4 py-6 text-center text-sm text-[var(--text-3)]">
            No frames yet. Add one above, by hand or by pasting a geometry table.
          </p>
        )}
      </section>
    </div>
  );
}

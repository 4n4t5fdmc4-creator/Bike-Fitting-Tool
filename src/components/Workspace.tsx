'use client';

import { useEffect, useMemo, useState } from 'react';
import { deg, mm } from '@/domain/units';
import { gripPoint } from '@/engine/forward';
import { deriveTarget } from '@/engine/target';
import { resolveCockpit } from '@/engine/assumptions';
import { recommendByModel } from '@/engine/recommend';
import { FRAME_LIBRARY } from '@/data/frames';
import { useStudio } from '@/state/studio';
import { ClientPanel } from './ClientPanel';
import { ReferenceBikePanel } from './ReferenceBikePanel';
import { FramesPanel } from './FramesPanel';
import { ModelCard } from './ModelCard';
import { StatRow } from './StatRow';

export function Workspace() {
  // zustand/persist only reads localStorage on the client. Rendering stored
  // values into static HTML that does not contain them is a hydration mismatch,
  // so hold back one frame instead of fighting it.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const clients = useStudio((s) => s.clients);
  const storedFrames = useStudio((s) => s.frames);
  const activeClientId = useStudio((s) => s.activeClientId);
  const addClient = useStudio((s) => s.addClient);

  const client = clients.find((c) => c.id === activeClientId) ?? null;

  const target = useMemo(() => {
    if (!client) return null;
    const m = client.measurements;
    const derived = deriveTarget({
      height: mm(m.heightCm * 10),
      inseam: mm(m.inseamCm * 10),
      style: m.style,
      flexibility: m.flexibility,
    });

    // A measured bike beats a formula every time. When one is on file, it
    // replaces the estimated grip point and the uncertainty collapses to what
    // the measurement itself carries.
    const ref = client.referenceBike;
    if (client.targetMode === 'reference' && ref) {
      const grip = gripPoint(
        { stack: mm(ref.stack), reach: mm(ref.reach), headTubeAngle: deg(ref.headTubeAngle) },
        resolveCockpit({
          stemLength: mm(ref.stemLength),
          stemAngle: deg(ref.stemAngle),
          spacerHeight: mm(ref.spacerHeight),
          barReach: mm(ref.barReach),
          barRise: mm(ref.barRise),
        }),
      );
      return { ...derived, grip, uncertainty: mm(5) };
    }
    return derived;
  }, [client]);

  // The fitter's own frames replace the examples as soon as there are any.
  const catalogue = useMemo(
    () =>
      storedFrames.length > 0
        ? storedFrames.map((f) => ({
            id: f.id, model: f.model, size: f.size,
            stack: mm(f.stack), reach: mm(f.reach),
            headTubeAngle: deg(f.headTubeAngle),
            maxSpacerStack: mm(f.maxSpacerStack),
          }))
        : FRAME_LIBRARY.map((f) => ({
            id: f.id, model: f.model, size: f.size,
            stack: f.stack, reach: f.reach,
            headTubeAngle: f.headTubeAngle,
            maxSpacerStack: f.maxSpacerStack,
          })),
    [storedFrames],
  );

  const usingExamples = storedFrames.length === 0;

  // Grouped by model: the question is which SIZE of a bike, not which of forty
  // rows. Every size stays available behind the recommendation.
  const models = useMemo(() => {
    if (!target) return [];
    const ref = client?.targetMode === 'reference' ? client.referenceBike : null;
    // A fitted client's own cockpit is the neutral one - see CockpitNeutral.
    const neutral = ref
      ? { stemLength: ref.stemLength, spacerHeight: ref.spacerHeight }
      : undefined;
    return recommendByModel(catalogue, target.grip, resolveCockpit(), neutral);
  }, [target, catalogue, client]);

  if (!ready) {
    return (
      <div className="mx-auto max-w-6xl space-y-3 px-4 py-8">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-[10px] bg-[var(--border)]/40" />
        ))}
      </div>
    );
  }

  if (!client) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="rounded-[10px] border border-dashed border-[var(--border)] bg-[var(--panel)] p-10 text-center">
          <h2 className="text-lg font-semibold">
            {clients.length === 0 ? 'No clients yet' : 'No client selected'}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-2)]">
            {clients.length === 0
              ? 'Create a client record to enter their measurements and see which frames can be built to their position.'
              : 'Pick a client from the switcher above, or start a new record.'}
          </p>
          <button
            onClick={() => addClient('New client')}
            className="mt-5 rounded-md bg-[var(--acc)] px-4 py-2 text-sm font-semibold text-black"
          >
            New client
          </button>
          <p className="mx-auto mt-6 max-w-md text-xs text-[var(--text-3)]">
            Records stay in this browser. Nothing is uploaded anywhere. Use <b>Export all</b> to back
            them up or move them to another machine.
          </p>
        </div>
      </div>
    );
  }

  const excellent = models.filter((m) => m.best.evaluation.verdict === 'excellentFit').length;
  const referenceLabel =
    client.targetMode === 'reference' && client.referenceBike?.label
      ? client.referenceBike.label
      : 'target position';

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <ClientPanel client={client} />
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
            Recommended frames
          </h2>
          <span className="text-xs text-[var(--text-3)]">
            {usingExamples
              ? `${catalogue.length} verified sizes from Pinarello — add your own above`
              : `${catalogue.length} sizes you entered`}
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
      </section>
    </div>
  );
}

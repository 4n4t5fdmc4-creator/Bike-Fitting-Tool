'use client';

import { useEffect, useMemo, useState } from 'react';
import { deg, mm } from '@/domain/units';
import { gripPoint } from '@/engine/forward';
import { deriveTarget } from '@/engine/target';
import { resolveCockpit } from '@/engine/assumptions';
import { recommendByModel } from '@/engine/recommend';
import { virtualFrameStackReach } from '@/engine/virtualFrame';
import { FRAME_LIBRARY } from '@/data/frames';
import { useStudio } from '@/state/studio';
import { TabNav, type TabId } from './tabs/TabNav';
import { ProfileTab } from './tabs/ProfileTab';
import { BikesTab } from './tabs/BikesTab';
import { OverlayTab } from './tabs/OverlayTab';
import { CockpitTab } from './tabs/CockpitTab';
import { MatrixTabWrapper } from './tabs/MatrixTabWrapper';

export function Workspace() {
  // zustand/persist only reads localStorage on the client. Rendering stored
  // values into static HTML that does not contain them is a hydration mismatch,
  // so hold back one frame instead of fighting it.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const [tab, setTab] = useState<TabId>('profile');

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
            seatTubeAngle: deg(f.seatTubeAngle),
          }))
        : FRAME_LIBRARY.map((f) => ({
            id: f.id, model: f.model, size: f.size,
            stack: f.stack, reach: f.reach,
            headTubeAngle: f.headTubeAngle,
            maxSpacerStack: f.maxSpacerStack,
            seatTubeAngle: f.seatTubeAngle,
          })),
    [storedFrames],
  );

  const usingExamples = storedFrames.length === 0;

  // Grouped by model: the question is which SIZE of a bike, not which of forty
  // rows. Every size stays available behind the recommendation.
  const models = useMemo(() => {
    if (!target) return [];
    const ref = client?.targetMode === 'reference' ? client.referenceBike : null;
    // The candidate must be evaluated with the SAME handlebar the target was
    // measured on. Carrying a fit across bikes means carrying the bar across
    // too - assuming a generic bar here made the client's own frame fail to
    // reproduce his own build.
    const base = ref
      ? resolveCockpit({ barReach: mm(ref.barReach), barRise: mm(ref.barRise) })
      : resolveCockpit();
    // A fitted client's own cockpit is the neutral one - see CockpitNeutral.
    const neutral = ref
      ? { stemLength: ref.stemLength, spacerHeight: ref.spacerHeight, stemAngle: ref.stemAngle }
      : undefined;
    return recommendByModel(catalogue, target.grip, base, neutral);
  }, [target, catalogue, client]);

  const referenceLabel =
    client?.targetMode === 'reference' && client.referenceBike?.label
      ? client.referenceBike.label
      : 'the target position';

  // The matrix compares raw frame geometry to a starting point - a real
  // reference bike's own stack/reach when there is one, otherwise a derived
  // estimate. Never invented silently: the estimate is labelled everywhere
  // it appears.
  const matrixAnchor = useMemo(() => {
    const ref = client?.targetMode === 'reference' ? client.referenceBike : null;
    if (ref) return { stack: ref.stack, reach: ref.reach };
    if (target) return virtualFrameStackReach(target.grip);
    return { stack: 570, reach: 385 };
  }, [client, target]);
  const anchorIsEstimated = !(client?.targetMode === 'reference' && client.referenceBike);

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

  return (
    <>
      <TabNav active={tab} onChange={setTab} />
      <div className="mx-auto max-w-6xl px-4 py-6">
        {tab === 'profile' && <ProfileTab client={client} />}

        {tab === 'bikes' && (
          <BikesTab
            client={client}
            target={target}
            models={models}
            usingExamples={usingExamples}
            catalogueCount={catalogue.length}
            referenceLabel={referenceLabel}
          />
        )}

        {tab === 'overlay' && (
          <OverlayTab models={models} referenceBike={client.targetMode === 'reference' ? client.referenceBike : null} />
        )}

        {tab === 'cockpit' && (
          <CockpitTab
            models={models}
            target={target?.grip ?? null}
            referenceBike={client.targetMode === 'reference' ? client.referenceBike : null}
          />
        )}

        {tab === 'matrix' && (
          <MatrixTabWrapper
            models={models}
            anchor={matrixAnchor}
            referenceLabel={referenceLabel}
            anchorIsEstimated={anchorIsEstimated}
          />
        )}
      </div>
    </>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { deg, mm } from '@/domain/units';
import { gripPoint } from '@/engine/forward';
import { deriveTarget } from '@/engine/target';
import { resolveCockpit } from '@/engine/assumptions';
import { recommendByModel, type CandidateFrame } from '@/engine/recommend';
import { virtualFrameStackReach } from '@/engine/virtualFrame';
import { FRAME_LIBRARY } from '@/data/frames';
import { decisionsOf, useStudio } from '@/state/studio';
import { useActiveTab } from '@/state/activeTab';
import { useOverlaySelection } from '@/state/overlaySelection';
import { TabNav, type TabId } from './tabs/TabNav';
import { StepIndicator } from './StepIndicator';
import { ProfileTab } from './tabs/ProfileTab';
import { BikesTab } from './tabs/BikesTab';
import { OverlayTab } from './tabs/OverlayTab';
import { CockpitTab } from './tabs/CockpitTab';
import { MatrixTabWrapper } from './tabs/MatrixTabWrapper';
import { ReportTab } from './tabs/ReportTab';
import { AccufitPanel } from './AccufitPanel';

/**
 * Both frame sources - the fitter's stored frames and the built-in library -
 * collapse to the same candidate shape here. Secondary geometry is passed
 * through only when present, so the overlay can tell a measured tube from a
 * typical fallback.
 */
const toCandidate = (f: {
  id: string; model: string; size: string;
  stack: number; reach: number; headTubeAngle: number; maxSpacerStack: number;
  seatTubeAngle?: number | undefined; headTubeLength?: number | undefined;
  chainstay?: number | undefined; effectiveTopTube?: number | undefined;
  wheelbase?: number | undefined; bbDrop?: number | undefined; tyreMax?: number | undefined;
  trail?: number | undefined;
  cockpitType?: 'open' | 'semi-integrated' | 'integrated' | undefined;
  sourceUrl?: string | undefined;
  stockStem?: number | undefined; stockStemAngle?: number | undefined;
  stockSpacers?: number | undefined;
}): CandidateFrame => ({
  id: f.id, model: f.model, size: f.size,
  stack: mm(f.stack), reach: mm(f.reach), headTubeAngle: deg(f.headTubeAngle),
  maxSpacerStack: mm(f.maxSpacerStack),
  ...(f.seatTubeAngle !== undefined ? { seatTubeAngle: deg(f.seatTubeAngle) } : {}),
  ...(f.headTubeLength !== undefined ? { headTubeLength: mm(f.headTubeLength) } : {}),
  ...(f.chainstay !== undefined ? { chainstay: mm(f.chainstay) } : {}),
  ...(f.effectiveTopTube !== undefined ? { effectiveTopTube: mm(f.effectiveTopTube) } : {}),
  ...(f.wheelbase !== undefined ? { wheelbase: mm(f.wheelbase) } : {}),
  ...(f.bbDrop !== undefined ? { bbDrop: mm(f.bbDrop) } : {}),
  ...(f.tyreMax !== undefined ? { tyreMax: mm(f.tyreMax) } : {}),
  ...(f.trail !== undefined ? { trail: mm(f.trail) } : {}),
  ...(f.cockpitType !== undefined ? { cockpitType: f.cockpitType } : {}),
  ...(f.sourceUrl ? { sourceUrl: f.sourceUrl } : {}),
  ...(f.stockStem !== undefined ? { stockStem: mm(f.stockStem) } : {}),
  ...(f.stockStemAngle !== undefined ? { stockStemAngle: deg(f.stockStemAngle) } : {}),
  ...(f.stockSpacers !== undefined ? { stockSpacers: mm(f.stockSpacers) } : {}),
});

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
  const studio = useStudio((s) => s.studio);

  const client = clients.find((c) => c.id === activeClientId) ?? null;

  // The open tab is kept per client and persisted, so switching to another
  // client and back returns to where the fitter was, not to step 1.
  const storedTab = useActiveTab((s) => (activeClientId ? s.byClient[activeClientId] : undefined));
  const setStoredTab = useActiveTab((s) => s.setTab);
  const tab: TabId = storedTab ?? 'profile';
  const setTab = (t: TabId) => {
    if (activeClientId) setStoredTab(activeClientId, t);
  };

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
        ? storedFrames.map(toCandidate)
        : FRAME_LIBRARY.map(toCandidate),
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

  // The comparison selection is shared by Compare, Cockpit and Matrix. Prune
  // ids whose frame is gone and seed the top three when nothing is picked -
  // once, here, so the set is the same whichever tab the fitter opens first.
  const setSelectedIds = useOverlaySelection((s) => s.setSelectedIds);
  const comparedCount = useOverlaySelection((s) => s.selectedIds.length);
  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = new Set(models.flatMap((m) => m.allSizes.map((s) => s.frame.id)));
      const kept = prev.filter((id) => valid.has(id));
      return kept.length > 0 ? kept : models.slice(0, 3).map((m) => m.best.frame.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models.length, setSelectedIds]);

  const referenceLabel =
    client?.targetMode === 'reference' && client.referenceBike?.label
      ? client.referenceBike.label
      : 'the target position';

  const hasReferenceBike = client?.targetMode === 'reference' && client.referenceBike !== null;

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

  // Views that make sense on paper. Report is the one a client is handed;
  // Overlay, Accufit and Matrix are the working sheets behind it.
  const PRINT_TITLES: Partial<Record<TabId, string>> = {
    overlay: 'Frame comparison',
    accufit: 'Buildable configurations',
    matrix: 'Fit matrix',
    report: 'Fit report',
  };
  const printTitle = PRINT_TITLES[tab];
  const printable = printTitle !== undefined;

  return (
    <>
      <TabNav active={tab} onChange={setTab} />

      <div className="no-print mx-auto max-w-6xl px-4 pt-3">
        <StepIndicator
          hasReferenceBike={hasReferenceBike}
          usingExamples={usingExamples}
          frameCount={models.length}
          comparedCount={comparedCount}
          decisionCount={decisionsOf(client).length}
        />
      </div>

      <div className={`mx-auto max-w-6xl px-4 py-6 ${printable ? 'printable' : ''}`}>
        {printable && (
          <>
            <div className="no-print mb-3 flex justify-end">
              <button
                onClick={() => window.print()}
                className="rounded-md border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--text-2)] hover:border-[var(--acc)] hover:text-[var(--foreground)]"
              >
                Print / PDF
              </button>
            </div>
            <PrintHeader
              studioName={studio.name}
              clientName={client.name}
              view={printTitle}
              referenceLabel={referenceLabel}
            />
          </>
        )}

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

        {tab === 'accufit' && (
          <AccufitPanel
            models={models}
            target={target?.grip ?? null}
            referenceBike={client.targetMode === 'reference' ? client.referenceBike : null}
            clientId={client.id}
          />
        )}

        {tab === 'report' && (
          <ReportTab
            client={client}
            target={target?.grip ?? null}
            referenceLabel={referenceLabel}
          />
        )}

        {tab === 'matrix' && (
          <MatrixTabWrapper
            models={models}
            anchor={matrixAnchor}
            referenceLabel={referenceLabel}
            anchorIsEstimated={anchorIsEstimated}
            targetGrip={target?.grip ?? null}
            referenceBike={client.targetMode === 'reference' ? client.referenceBike : null}
          />
        )}
      </div>
    </>
  );
}

/**
 * Shown only on paper (`.print-only`): the fitter hands the client a sheet, and
 * a sheet needs to say whose fit it is and when it was run.
 */
function PrintHeader({
  studioName, clientName, view, referenceLabel,
}: {
  studioName: string;
  clientName: string;
  view: string;
  referenceLabel: string;
}) {
  return (
    <header className="print-only mb-4 border-b border-[var(--border)] pb-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold">{studioName || 'Bike fitting'}</span>
        <span className="text-xs">{new Date().toLocaleDateString()}</span>
      </div>
      <div className="mt-0.5 text-xs">
        {view} — client: {clientName} · measured against {referenceLabel}
      </div>
    </header>
  );
}

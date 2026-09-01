'use client';

import { useEffect, useMemo, useState } from 'react';
import { mm } from '@/domain/units';
import { deriveTarget } from '@/engine/target';
import { resolveCockpit } from '@/engine/assumptions';
import { evaluateFrame } from '@/engine/score';
import { explain } from '@/engine/explain';
import { FRAME_LIBRARY } from '@/data/frames';
import { RiderForm } from './RiderForm';
import { ResultCard } from './ResultCard';
import { useStore } from '@/state/store';

export function Workspace() {
  // zustand/persist reads localStorage only on the client. Rendering the stored
  // values before that would mismatch the static HTML, so hold the results back
  // for one frame rather than fighting hydration.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const rider = useStore((s) => s.rider);
  const setRider = useStore((s) => s.setRider);

  const target = useMemo(
    () =>
      deriveTarget({
        height: mm(rider.heightCm * 10),
        inseam: mm(rider.inseamCm * 10),
        style: rider.style,
        flexibility: rider.flexibility,
      }),
    [rider],
  );

  const results = useMemo(() => {
    const base = resolveCockpit();
    return FRAME_LIBRARY.map((frame) => {
      const evaluation = evaluateFrame(frame, target.grip, base, undefined, frame.maxSpacerStack);
      return {
        frame,
        evaluation,
        explanation: explain(evaluation, `${frame.model} ${frame.size}`, frame.maxSpacerStack),
      };
    }).sort((a, b) => b.evaluation.composite - a.evaluation.composite);
  }, [target]);

  // Always show the top of the ranking, never an empty state. A rider whose
  // position no frame reaches still needs to see which came closest and why -
  // "nothing fits" with everything collapsed is a dead end, and for small riders
  // wanting a big drop it is also the common case: head tubes do not get short
  // enough, so the honest answer is "here is the closest, and here is the
  // reason", not silence.
  const TOP = 5;
  const best = results.slice(0, TOP);
  const rest = results.slice(TOP);
  const excellent = results.filter((r) => r.evaluation.verdict === 'excellentFit').length;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Bike Fitting Tool</h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          Enter your measurements, then see which frames can put your hands where they need to be.
        </p>
      </header>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
          Step 1 · Your measurements
        </h2>
        <RiderForm rider={rider} onChange={setRider} />
      </section>

      <section className="mt-8 rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
          Step 2 · Your target position
        </h2>
        {ready ? (
          <>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
              <Stat label="Grip reach" value={`${Math.round(target.grip.x)} mm`} />
              <Stat label="Grip stack" value={`${Math.round(target.grip.y)} mm`} />
              <Stat label="Saddle height" value={`${Math.round(target.saddleHeight)} mm`} />
              <Stat label="Bar drop" value={`${Math.round(target.drop)} mm`} />
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-[var(--muted-foreground)]">
              Measured from the bottom bracket, to the centre of the brake hoods. Derived from your
              height and inseam using established rules of thumb, so treat it as a band of roughly
              ±{Math.round(target.uncertainty)} mm — not a prescription. It narrows the frame
              search; it is not a bike fit.
            </p>
          </>
        ) : (
          <div className="mt-3 h-16 animate-pulse rounded bg-[var(--border)]/40" />
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
          Step 3 · Frames that fit
        </h2>
        <p className="mt-2 rounded-[10px] border border-[var(--status-warning)]/40 bg-[var(--status-warning)]/10 px-3 py-2 text-xs text-[var(--muted-foreground)]">
          <b className="text-[var(--foreground)]">Example frame data.</b> These geometries are
          realistic but invented — no real bike is named. Importing real geometry tables comes next.
        </p>

        {!ready ? (
          <div className="mt-4 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-[10px] bg-[var(--border)]/40" />
            ))}
          </div>
        ) : (
          <>
            <p className="mt-4 text-sm text-[var(--muted-foreground)]">
              {excellent > 0 ? (
                <>
                  <b className="text-[var(--foreground)]">{excellent}</b> of {results.length} frames
                  reach your position with an ordinary cockpit. Best matches first.
                </>
              ) : (
                <>
                  <b className="text-[var(--foreground)]">No frame here reaches your position with
                  an ordinary cockpit.</b>{' '}
                  That is a real answer, not a gap in the list — a low position on a small frame
                  often runs out of head tube before it runs out of spacers. These came closest.
                </>
              )}
            </p>
            <ul className="mt-3 space-y-2">
              {best.map((r) => (
                <ResultCard key={r.frame.id} {...r} />
              ))}
            </ul>

            <details className="mt-6">
              <summary className="cursor-pointer text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                Show the remaining {rest.length} frames — each with its reason
              </summary>
              <ul className="mt-3 space-y-2">
                {rest.map((r) => (
                  <ResultCard key={r.frame.id} {...r} />
                ))}
              </ul>
            </details>
          </>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--muted-foreground)]">{label}</dt>
      <dd className="tabular mt-0.5 text-lg font-medium">{value}</dd>
    </div>
  );
}

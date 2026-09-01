import { deg, mm } from '@/domain/units';
import type { FrameCore } from '@/engine/forward';
import { gripPoint } from '@/engine/forward';
import { resolveCockpit } from '@/engine/assumptions';
import { evaluateFrame } from '@/engine/score';
import { explain } from '@/engine/explain';
import { EnvBanner } from '@/components/EnvBanner';

/**
 * Phase 0 proof of life. This page is not the product - it exists to show that
 * the static export, the engine and the design tokens work together, computed
 * at build time with no client JavaScript doing the maths.
 */

const frame = (stack: number, reach: number, hta: number): FrameCore => ({
  stack: mm(stack), reach: mm(reach), headTubeAngle: deg(hta),
});

const REFERENCE = frame(565, 395, 73.5);
const TARGET = gripPoint(
  REFERENCE,
  resolveCockpit({ stemLength: mm(100), stemAngle: deg(-6), spacerHeight: mm(20) }),
);

const FRAMES: ReadonlyArray<{ label: string; frame: FrameCore }> = [
  { label: 'Race 52', frame: frame(525, 380, 72.5) },
  { label: 'Race 54', frame: frame(545, 388, 73.0) },
  { label: 'Race 56', frame: REFERENCE },
  { label: 'Race 58', frame: frame(585, 403, 73.5) },
  { label: 'Race 60', frame: frame(605, 412, 73.5) },
  { label: 'Endurance 56', frame: frame(592, 387, 72.0) },
  { label: 'Gravel M', frame: frame(595, 383, 71.0) },
  { label: 'Comfort XL', frame: frame(660, 385, 70.5) },
];

const VERDICT_STYLE: Record<string, { color: string; icon: string; label: string }> = {
  excellentFit: { color: 'var(--status-good)', icon: '✓', label: 'Excellent fit' },
  worksWithModerateAdjustment: { color: 'var(--status-warning)', icon: '~', label: 'Moderate adjustment' },
  borderline: { color: 'var(--status-serious)', icon: '!', label: 'Borderline' },
  notRecommended: { color: 'var(--status-critical)', icon: '×', label: 'Not recommended' },
};

export default function Page() {
  const rows = FRAMES.map(({ label, frame: f }) => {
    const evaluation = evaluateFrame(f, TARGET, resolveCockpit());
    return { label, evaluation, explanation: explain(evaluation, label) };
  }).sort((a, b) => b.evaluation.composite - a.evaluation.composite);

  return (
    <>
      <EnvBanner />
      <main className="mx-auto max-w-3xl px-5 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Bike Fitting Tool</h1>
        <p className="mt-2 text-[var(--muted-foreground)]">
          Compare bike frames, geometries and adjust to individual personal needs.
        </p>

        <section className="mt-10 rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
            Target position
          </h2>
          <p className="mt-2 text-sm">
            Grip reach <b className="tabular">{TARGET.x.toFixed(1)} mm</b>, grip stack{' '}
            <b className="tabular">{TARGET.y.toFixed(1)} mm</b> from the bottom bracket — taken
            from a Race 56 with a 100 mm −6° stem and 20 mm of spacers.
          </p>
        </section>

        <h2 className="mt-10 text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
          Ranked by the engine, at build time
        </h2>

        <ul className="mt-3 space-y-2">
          {rows.map(({ label, evaluation, explanation }) => {
            const style = VERDICT_STYLE[evaluation.verdict]!;
            return (
              <li
                key={label}
                className="rounded-[10px] border border-[var(--border)] bg-[var(--card)] p-4"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-medium">{label}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{ color: style.color, background: `color-mix(in srgb, ${style.color} 15%, transparent)` }}
                  >
                    {style.icon} {style.label}
                  </span>
                  <span className="tabular ml-auto text-sm text-[var(--muted-foreground)]">
                    {evaluation.composite.toFixed(1)}
                  </span>
                </div>
                <p className="mt-2 text-sm">{explanation.verdict}</p>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                  {explanation.mechanism ?? explanation.requirement}
                </p>
              </li>
            );
          })}
        </ul>

        <footer className="mt-12 text-sm text-[var(--muted-foreground)]">
          Computed at build time by <code>src/engine</code>. No client-side maths, no server.
        </footer>
      </main>
    </>
  );
}

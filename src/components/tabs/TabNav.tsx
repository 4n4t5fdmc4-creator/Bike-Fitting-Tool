'use client';

/**
 * Two-level navigation: three steps, each with its own views.
 *
 * The old bar was five numbered tabs in a row, which promised a linear wizard
 * and then broke the promise - a fitter bounces between Compare, Cockpit and
 * Matrix a dozen times inside one step of the actual job. Numbering them 1..5
 * made that jumping feel like going backwards.
 *
 * The three steps are the real phases of a fit session, and they ARE ordered:
 * find out who the client is, work out which bike, hand over a sheet. The
 * views inside a step are not ordered and are not numbered - they are four
 * ways of looking at the same comparison, so they read as a view switch.
 */

export type TabId =
  | 'profile' | 'bikes'
  | 'overlay' | 'cockpit' | 'accufit' | 'matrix'
  | 'report';

export type StepId = 'client' | 'compare' | 'report';

export interface Step {
  readonly id: StepId;
  readonly n: number;
  readonly label: string;
  /** What this step is for, in the fitter's words. Shown under the step. */
  readonly hint: string;
  readonly views: ReadonlyArray<{ readonly id: TabId; readonly label: string }>;
}

export const STEPS: ReadonlyArray<Step> = [
  {
    id: 'client', n: 1, label: 'Client', hint: 'measurements, current bike, frames on the table',
    views: [
      { id: 'profile', label: 'Profile' },
      { id: 'bikes', label: 'Frames' },
    ],
  },
  {
    id: 'compare', n: 2, label: 'Compare', hint: 'which frame, and what it would take',
    views: [
      { id: 'overlay', label: 'Overlay' },
      { id: 'cockpit', label: 'Cockpit' },
      { id: 'accufit', label: 'Accufit' },
      { id: 'matrix', label: 'Matrix' },
    ],
  },
  {
    id: 'report', n: 3, label: 'Report', hint: 'what the client takes home',
    views: [{ id: 'report', label: 'Report' }],
  },
];

const STEP_OF = new Map<TabId, StepId>(
  STEPS.flatMap((s) => s.views.map((v) => [v.id, s.id] as const)),
);

export function stepOf(tab: TabId): StepId {
  return STEP_OF.get(tab) ?? 'client';
}

/** The view a step opens on when it is entered from the step bar. */
export function firstViewOf(step: StepId): TabId {
  return STEPS.find((s) => s.id === step)?.views[0]?.id ?? 'profile';
}

export function TabNav({
  active, onChange,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
}) {
  const current = stepOf(active);
  const step = STEPS.find((s) => s.id === current) ?? STEPS[0]!;

  return (
    <nav className="no-print sticky top-[49px] z-10 -mx-4 border-b border-[var(--border)] bg-[var(--background)]/95 px-4 backdrop-blur">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-stretch gap-1 overflow-x-auto">
          {STEPS.map((s) => {
            const on = s.id === current;
            return (
              <button
                key={s.id}
                onClick={() => onChange(firstViewOf(s.id))}
                aria-current={on ? 'step' : undefined}
                className={`group flex min-w-0 items-baseline gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-left transition-colors ${
                  on
                    ? 'border-[var(--acc)] text-[var(--foreground)]'
                    : 'border-transparent text-[var(--text-3)] hover:text-[var(--text-2)]'
                }`}
              >
                <span
                  className={`tabular grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                    on ? 'bg-[var(--acc)] text-black' : 'bg-[var(--panel-2)] text-[var(--text-3)]'
                  }`}
                >
                  {s.n}
                </span>
                <span className="text-sm font-medium">{s.label}</span>
                <span className="hidden truncate text-[11px] text-[var(--text-3)] sm:inline">
                  {s.hint}
                </span>
              </button>
            );
          })}
        </div>

        {step.views.length > 1 && (
          <div className="flex gap-0.5 overflow-x-auto pb-2 pt-1.5">
            {step.views.map((v) => {
              const on = v.id === active;
              return (
                <button
                  key={v.id}
                  onClick={() => onChange(v.id)}
                  aria-pressed={on}
                  className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs transition-colors ${
                    on
                      ? 'bg-[var(--panel-2)] font-semibold text-[var(--foreground)]'
                      : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
                  }`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}

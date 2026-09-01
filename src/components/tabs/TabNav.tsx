'use client';

export type TabId = 'profile' | 'bikes' | 'overlay' | 'cockpit' | 'matrix';

export const TABS: ReadonlyArray<{ id: TabId; label: string; step: number }> = [
  { id: 'profile', label: 'Profile', step: 1 },
  { id: 'bikes', label: 'Bikes', step: 2 },
  { id: 'overlay', label: 'Compare', step: 3 },
  { id: 'cockpit', label: 'Cockpit', step: 4 },
  { id: 'matrix', label: 'Matrix', step: 5 },
];

export function TabNav({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav className="sticky top-[49px] z-10 -mx-4 border-b border-[var(--border)] bg-[var(--background)]/95 px-4 backdrop-blur">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
              active === t.id
                ? 'border-[var(--acc)] text-[var(--foreground)]'
                : 'border-transparent text-[var(--text-3)] hover:text-[var(--text-2)]'
            }`}
          >
            <span className="tabular mr-1.5 text-[var(--text-3)]">{t.step}</span>
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

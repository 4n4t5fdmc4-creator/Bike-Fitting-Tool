'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TabId } from '@/components/tabs/TabNav';

/**
 * The tab a fitter last had open, kept per client and persisted.
 *
 * A fit session is not linear: the fitter jumps back to the Matrix mid-cockpit,
 * switches to another client to check something, and comes back. Resetting to
 * step 1 on every client switch threw that work away. The map is keyed by
 * client id so two clients open in the same browser do not share a position.
 */
interface ActiveTabStore {
  byClient: Record<string, TabId>;
  setTab: (clientId: string, tab: TabId) => void;
  /** Drop a client's entry when its record is deleted. */
  forget: (clientId: string) => void;
}

export const useActiveTab = create<ActiveTabStore>()(
  persist(
    (set) => ({
      byClient: {},
      setTab: (clientId, tab) =>
        set((s) => ({ byClient: { ...s.byClient, [clientId]: tab } })),
      forget: (clientId) =>
        set((s) => {
          if (!(clientId in s.byClient)) return s;
          const next = { ...s.byClient };
          delete next[clientId];
          return { byClient: next };
        }),
    }),
    { name: 'bft-active-tab' },
  ),
);

'use client';

import { create } from 'zustand';

/**
 * The frames ticked in the Overlay tab, lifted out of the component so other
 * tabs can read the same working set. Right now the Matrix scatter uses it to
 * label exactly the frames the fitter is already comparing; prompt 8 widens
 * this to Compare and Cockpit too.
 *
 * Deliberately not persisted: it is a within-session selection, re-seeded from
 * the current recommendations each visit.
 */
type Updater = ReadonlyArray<string> | ((prev: string[]) => string[]);

interface OverlaySelectionStore {
  selectedIds: string[];
  setSelectedIds: (next: Updater) => void;
}

export const useOverlaySelection = create<OverlaySelectionStore>((set) => ({
  selectedIds: [],
  setSelectedIds: (next) =>
    set((s) => ({
      selectedIds: typeof next === 'function' ? next(s.selectedIds) : [...next],
    })),
}));

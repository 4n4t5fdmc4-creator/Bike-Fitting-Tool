'use client';

import { create } from 'zustand';

/**
 * The frames the fitter is actively comparing, lifted out of any one component
 * so every tab reads the same working set:
 *
 *  - Compare toggles frames in and out of it and draws all of them.
 *  - Cockpit takes the first two as bike A and bike B.
 *  - Matrix labels exactly these dots on the scatter.
 *
 * A pick made on one tab therefore carries to the others. Order matters -
 * position 0 and 1 are Cockpit's A and B - so it is a list, not a set.
 *
 * Deliberately not persisted: it is a within-session selection, re-seeded from
 * the current recommendations when it is empty.
 */
/**
 * Four, not eight.
 *
 * Eight was a capability, not a use: with every size of every model offered as
 * a chip, the overlay filled with bikes nobody was choosing between, and the
 * one comparison that mattered was buried under seven that did not. A fitter
 * decides between a handful of candidates — usually two sizes of two models —
 * and the reference bike is drawn on top of that regardless.
 */
export const OVERLAY_CAP = 4;

type Updater = ReadonlyArray<string> | ((prev: string[]) => string[]);

interface OverlaySelectionStore {
  selectedIds: string[];
  setSelectedIds: (next: Updater) => void;
  /** Put `id` at `index` (0 = Cockpit A, 1 = Cockpit B), moving it if already picked. */
  setAt: (index: number, id: string) => void;
  /** Seed from the recommendations, but only while nothing is picked yet. */
  seedIfEmpty: (ids: ReadonlyArray<string>) => void;
}

const cap = (ids: string[]): string[] => ids.slice(0, OVERLAY_CAP);

export const useOverlaySelection = create<OverlaySelectionStore>((set) => ({
  selectedIds: [],
  setSelectedIds: (next) =>
    set((s) => ({
      selectedIds: cap(typeof next === 'function' ? next(s.selectedIds) : [...next]),
    })),
  setAt: (index, id) =>
    set((s) => {
      const next = s.selectedIds.filter((x) => x !== id);
      if (index < next.length) next[index] = id;
      else next.push(id);
      return { selectedIds: cap(next) };
    }),
  seedIfEmpty: (ids) =>
    set((s) => (s.selectedIds.length === 0 ? { selectedIds: cap([...ids]) } : s)),
}));

'use client';

import { create } from 'zustand';

/**
 * How finished bikes are compared, shared between the Compare overlay and the
 * Matrix hood plot so the two never disagree.
 *
 *  - `as-fitted`    — each bike with its own recommended build.
 *  - `same-cockpit` — every bike gets the one cockpit on the sliders, so only
 *                     the frames differ.
 *
 * The cockpit lives here too, so "the cockpit currently on the sliders" means
 * the same thing on both tabs. It is seeded from the client's reference bike
 * and stops auto-seeding once the fitter drags a slider.
 */
export type FitMode = 'as-fitted' | 'same-cockpit';

export interface ComparisonCockpit {
  stemLength: number;
  stemAngle: number;
  spacerHeight: number;
  barReach: number;
  barRise: number;
}

const DEFAULT_COCKPIT: ComparisonCockpit = {
  stemLength: 100, stemAngle: -6, spacerHeight: 20, barReach: 80, barRise: 0,
};

interface ComparisonModeStore {
  fitMode: FitMode;
  setFitMode: (m: FitMode) => void;

  cockpit: ComparisonCockpit;
  /** Set once the fitter moves a slider; suppresses re-seeding for that source. */
  userAdjusted: boolean;
  /** Identifies the bike the cockpit was last seeded from (its label, or 'none'). */
  seededKey: string | null;

  setCockpit: (patch: Partial<ComparisonCockpit>) => void;
  /**
   * Seed from the reference bike. A new source (e.g. a client switch) always
   * re-seeds; the same source is left alone once the fitter has adjusted it.
   */
  seedCockpit: (key: string, c: ComparisonCockpit) => void;
}

export const useComparisonMode = create<ComparisonModeStore>((set) => ({
  fitMode: 'as-fitted',
  setFitMode: (m) => set({ fitMode: m }),

  cockpit: DEFAULT_COCKPIT,
  userAdjusted: false,
  seededKey: null,

  setCockpit: (patch) =>
    set((s) => ({ cockpit: { ...s.cockpit, ...patch }, userAdjusted: true })),

  seedCockpit: (key, c) =>
    set((s) => {
      if (s.seededKey === key) return s.userAdjusted ? s : { cockpit: c };
      return { cockpit: c, userAdjusted: false, seededKey: key };
    }),
}));

'use client';

import { create } from 'zustand';

/**
 * The two-bike cockpit duel keeps one thing: each frame's cockpit, by frame id,
 * for the whole session. Switching a slot to another bike and back - or leaving
 * the tab and returning - never loses an edit.
 *
 * Which frames sit in slots A and B is NOT here: that is the shared comparison
 * selection (`useOverlaySelection`), so a pick made on Compare or Matrix lands
 * here too.
 *
 * Not persisted to disk: each cockpit starts from the frame's recommended
 * build, which depends on the current client.
 */
export interface DuelCockpit {
  stemLength: number;
  stemAngle: number;
  spacerHeight: number;
  barReach: number;
  barRise: number;
}

interface CockpitDuelStore {
  cockpits: Record<string, DuelCockpit>;
  setCockpit: (id: string, patch: Partial<DuelCockpit>) => void;
  /** Seed a frame's cockpit from its recommended build - only if it has none yet. */
  seedCockpit: (id: string, seed: DuelCockpit) => void;
}

export const useCockpitDuel = create<CockpitDuelStore>((set) => ({
  cockpits: {},
  setCockpit: (id, patch) =>
    set((s) => ({
      cockpits: {
        ...s.cockpits,
        [id]: { ...(s.cockpits[id] ?? DEFAULT_COCKPIT), ...patch },
      },
    })),
  seedCockpit: (id, seed) =>
    set((s) => (s.cockpits[id] ? s : { cockpits: { ...s.cockpits, [id]: seed } })),
}));

const DEFAULT_COCKPIT: DuelCockpit = {
  stemLength: 100, stemAngle: -6, spacerHeight: 20, barReach: 80, barRise: 0,
};

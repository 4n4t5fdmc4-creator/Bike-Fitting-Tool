'use client';

import { create } from 'zustand';

/**
 * The two-bike cockpit duel: which frames are in slots A and B, and each
 * frame's cockpit.
 *
 * Cockpits are kept per frame id for the whole session, so switching a slot to
 * another bike and back - or leaving the tab and returning - never loses an
 * edit. Not persisted to disk: each cockpit starts from the frame's recommended
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
  slotA: string | null;
  slotB: string | null;
  setSlot: (slot: 'A' | 'B', id: string) => void;

  cockpits: Record<string, DuelCockpit>;
  setCockpit: (id: string, patch: Partial<DuelCockpit>) => void;
  /** Seed a frame's cockpit from its recommended build - only if it has none yet. */
  seedCockpit: (id: string, seed: DuelCockpit) => void;
}

export const useCockpitDuel = create<CockpitDuelStore>((set) => ({
  slotA: null,
  slotB: null,
  setSlot: (slot, id) => set(slot === 'A' ? { slotA: id } : { slotB: id }),

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

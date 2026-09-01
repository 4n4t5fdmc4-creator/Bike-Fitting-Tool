'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Flexibility, RidingStyle } from '@/engine/target';

/**
 * Rider input. Persisted to localStorage so entering measurements is a one-time
 * cost - nothing leaves the device.
 *
 * Values are held in the units the rider types (centimetres), and converted at
 * the boundary. Storing what was typed keeps the form honest on reload.
 */
export interface RiderInput {
  heightCm: number;
  inseamCm: number;
  style: RidingStyle;
  flexibility: Flexibility;
}

interface Store {
  rider: RiderInput;
  hasEntered: boolean;
  setRider: (patch: Partial<RiderInput>) => void;
  reset: () => void;
}

const DEFAULT_RIDER: RiderInput = {
  heightCm: 180,
  inseamCm: 84,
  style: 'allround',
  flexibility: 'average',
};

export const useStore = create<Store>()(
  persist(
    (set) => ({
      rider: DEFAULT_RIDER,
      hasEntered: false,
      setRider: (patch) =>
        set((s) => ({ rider: { ...s.rider, ...patch }, hasEntered: true })),
      reset: () => set({ rider: DEFAULT_RIDER, hasEntered: false }),
    }),
    { name: 'bft-rider' },
  ),
);

'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Which explanatory blocks the fitter has collapsed, remembered across sessions.
 *
 * The explanations are worth their space the first time - what the Accufit
 * point is, why the tolerance is four numbers and not a radius, what the
 * overlay's dashed lines mean. They are worth nothing the fortieth time, and a
 * tool used daily is mostly fortieth times.
 *
 * So they open by default and stay closed once closed. Per-key rather than one
 * global switch: a fitter can know what the tolerance sliders do and still want
 * the Accufit note in front of them.
 */
interface ExplainerStore {
  collapsed: Record<string, boolean>;
  toggle: (key: string) => void;
}

export const useExplainers = create<ExplainerStore>()(
  persist(
    (set) => ({
      collapsed: {},
      toggle: (key) =>
        set((s) => ({ collapsed: { ...s.collapsed, [key]: !s.collapsed[key] } })),
    }),
    { name: 'bft-explainers' },
  ),
);

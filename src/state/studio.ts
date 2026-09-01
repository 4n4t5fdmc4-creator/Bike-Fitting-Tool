'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Flexibility, RidingStyle } from '@/engine/target';

/**
 * Studio and client records.
 *
 * PRIVACY. This is a static site: there is no server and no account, so
 * everything here lives in this browser's localStorage and nowhere else. That
 * is the strongest privacy position available - client data never leaves the
 * device unless the fitter deliberately exports it - and it has one hard
 * consequence: clearing site data destroys the records. Export is the backup.
 *
 * Exports are plain, readable JSON on purpose. A fitter emailing a client file
 * should be able to see exactly what is in it.
 */

export interface Measurements {
  heightCm: number;
  inseamCm: number;
  style: RidingStyle;
  flexibility: Flexibility;
}

/**
 * A frame the fitter entered or imported. Provenance travels with the values:
 * a number nobody can trace cannot be defended when a client disputes it.
 */
export interface StoredFrame {
  id: string;
  model: string;
  size: string;
  stack: number;
  reach: number;
  headTubeAngle: number;
  seatTubeAngle: number;
  maxSpacerStack: number;
  source: 'manual' | 'pasted';
  sourceUrl: string;
  addedAt: string;
}

/**
 * The client's current bike, used to MEASURE their position instead of
 * estimating it from body measurements. Always the better target when it exists.
 */
export interface ReferenceBike {
  label: string;
  stack: number;
  reach: number;
  headTubeAngle: number;
  stemLength: number;
  stemAngle: number;
  spacerHeight: number;
  barReach: number;
  barRise: number;
  /** Library id, or 'custom' when the numbers were typed by hand. */
  barId: string;
}

export interface Client {
  id: string;
  name: string;
  /** Free text: goals, complaints, previous fits. Never interpreted by the engine. */
  notes: string;
  measurements: Measurements;
  /** Set when the client's own bike defines the target. */
  referenceBike: ReferenceBike | null;
  /** Which one the recommendations run against. */
  targetMode: 'derived' | 'reference';
  createdAt: string;
  updatedAt: string;
}

export interface Studio {
  name: string;
  /** Logo as a data URL so it survives without a server. Kept small on purpose. */
  logo: string | null;
}

export const DEFAULT_MEASUREMENTS: Measurements = {
  heightCm: 178,
  inseamCm: 83,
  style: 'allround',
  flexibility: 'average',
};

/** Everything an export contains. Versioned so future imports can migrate. */
export interface ExportBundle {
  format: 'bike-fitting-tool';
  version: 1;
  exportedAt: string;
  studio: Studio;
  clients: Client[];
  frames?: StoredFrame[];
}

export const DEFAULT_REFERENCE: ReferenceBike = {
  label: 'Current bike',
  stack: 570, reach: 380, headTubeAngle: 72,
  stemLength: 100, stemAngle: -6, spacerHeight: 20,
  barReach: 80, barRise: 0, barId: 'generic-compact',
};

interface StudioState {
  studio: Studio;
  clients: Client[];
  frames: StoredFrame[];
  activeClientId: string | null;

  addFrame: (f: Omit<StoredFrame, 'id' | 'addedAt'>) => void;
  addFrames: (fs: ReadonlyArray<Omit<StoredFrame, 'id' | 'addedAt'>>) => number;
  removeFrame: (id: string) => void;

  setStudio: (patch: Partial<Studio>) => void;
  addClient: (name: string) => string;
  updateClient: (id: string, patch: Partial<Omit<Client, 'id' | 'createdAt'>>) => void;
  updateMeasurements: (id: string, patch: Partial<Measurements>) => void;
  removeClient: (id: string) => void;
  selectClient: (id: string | null) => void;

  exportAll: () => ExportBundle;
  exportClient: (id: string) => ExportBundle | null;
  importBundle: (bundle: unknown, mode: 'merge' | 'replace') => { added: number; error?: string };
}

const now = (): string => new Date().toISOString();
const newId = (): string =>
  `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

function isBundle(x: unknown): x is ExportBundle {
  if (typeof x !== 'object' || x === null) return false;
  const b = x as Partial<ExportBundle>;
  return b.format === 'bike-fitting-tool' && Array.isArray(b.clients);
}

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => ({
      studio: { name: '', logo: null },
      clients: [],
      frames: [],
      activeClientId: null,

      addFrame: (f) =>
        set((s) => ({
          frames: [...s.frames, { ...f, id: newId(), addedAt: now() }],
        })),

      addFrames: (fs) => {
        const made = fs.map((f) => ({ ...f, id: newId(), addedAt: now() }));
        set((s) => ({ frames: [...s.frames, ...made] }));
        return made.length;
      },

      removeFrame: (id) => set((s) => ({ frames: s.frames.filter((f) => f.id !== id) })),

      setStudio: (patch) => set((s) => ({ studio: { ...s.studio, ...patch } })),

      addClient: (name) => {
        const id = newId();
        const client: Client = {
          id,
          name: name.trim() || 'Unnamed client',
          notes: '',
          measurements: { ...DEFAULT_MEASUREMENTS },
          referenceBike: null,
          targetMode: 'derived',
          createdAt: now(),
          updatedAt: now(),
        };
        set((s) => ({ clients: [...s.clients, client], activeClientId: id }));
        return id;
      },

      updateClient: (id, patch) =>
        set((s) => ({
          clients: s.clients.map((c) =>
            c.id === id ? { ...c, ...patch, updatedAt: now() } : c,
          ),
        })),

      updateMeasurements: (id, patch) =>
        set((s) => ({
          clients: s.clients.map((c) =>
            c.id === id
              ? { ...c, measurements: { ...c.measurements, ...patch }, updatedAt: now() }
              : c,
          ),
        })),

      removeClient: (id) =>
        set((s) => ({
          clients: s.clients.filter((c) => c.id !== id),
          activeClientId: s.activeClientId === id ? null : s.activeClientId,
        })),

      selectClient: (id) => set({ activeClientId: id }),

      exportAll: () => ({
        format: 'bike-fitting-tool',
        version: 1,
        exportedAt: now(),
        studio: get().studio,
        clients: get().clients,
        frames: get().frames,
      }),

      exportClient: (id) => {
        const client = get().clients.find((c) => c.id === id);
        if (!client) return null;
        return {
          format: 'bike-fitting-tool',
          version: 1,
          exportedAt: now(),
          studio: get().studio,
          clients: [client],
        };
      },

      importBundle: (bundle, mode) => {
        if (!isBundle(bundle)) {
          return { added: 0, error: 'That file is not a Bike Fitting Tool export.' };
        }
        // Imported ids are re-issued so a merge can never overwrite an existing
        // client that happens to share an id.
        const incoming = bundle.clients.map((c) => ({
          ...c,
          id: newId(),
          updatedAt: now(),
        }));
        const frames = (bundle.frames ?? []).map((f) => ({ ...f, id: newId() }));
        set((s) => ({
          clients: mode === 'replace' ? incoming : [...s.clients, ...incoming],
          frames: mode === 'replace' ? frames : [...s.frames, ...frames],
          studio: bundle.studio?.name ? bundle.studio : s.studio,
          activeClientId: incoming[0]?.id ?? null,
        }));
        return { added: incoming.length };
      },
    }),
    { name: 'bft-studio' },
  ),
);

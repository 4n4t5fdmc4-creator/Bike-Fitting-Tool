'use client';

import { useRef, useState } from 'react';
import { useStudio } from '@/state/studio';
import { downloadJson, readJsonFile } from '@/lib/files';

const MAX_LOGO_BYTES = 200_000;

/**
 * The fitter's own header: logo, studio name, client switcher, data in and out.
 *
 * Branding is stored as a data URL rather than a file path, because there is no
 * server to host an upload - the logo has to travel inside the same localStorage
 * record as everything else, and inside exports.
 */
export function StudioBar() {
  const { studio, setStudio, clients, activeClientId, selectClient, addClient } = useStudio();
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);

  async function onLogo(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError(`That file is ${Math.round(file.size / 1024)} KB. Keep it under 200 KB — it is stored in this browser alongside your client records.`);
      return;
    }
    setLogoError(null);
    const reader = new FileReader();
    reader.onload = () => setStudio({ logo: String(reader.result) });
    reader.readAsDataURL(file);
  }

  async function onImport(file: File | undefined) {
    if (!file) return;
    const parsed = await readJsonFile(file);
    const mode = useStudio.getState().clients.length > 0 ? 'merge' : 'replace';
    const result = useStudio.getState().importBundle(parsed, mode);
    setLogoError(result.error ?? null);
  }

  return (
    <header className="no-print sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--panel)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2.5">
        <button
          onClick={() => logoInput.current?.click()}
          title={studio.logo ? 'Replace logo' : 'Add your logo'}
          className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--border)] bg-[var(--panel-2)] text-[10px] text-[var(--text-3)] hover:border-[var(--acc)]"
        >
          {studio.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={studio.logo} alt="" className="h-full w-full object-contain" />
          ) : (
            'LOGO'
          )}
        </button>
        <input
          ref={logoInput} type="file" accept="image/*" className="hidden"
          onChange={(e) => void onLogo(e.target.files?.[0])}
        />

        <input
          value={studio.name}
          onChange={(e) => setStudio({ name: e.target.value })}
          placeholder="Your studio name"
          aria-label="Studio name"
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-semibold hover:border-[var(--border)] focus:border-[var(--acc)] focus:outline-none"
        />

        <select
          value={activeClientId ?? ''}
          onChange={(e) => selectClient(e.target.value || null)}
          aria-label="Active client"
          className="max-w-[14rem] rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1.5 text-sm"
        >
          <option value="">— no client selected —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <button
          onClick={() => addClient('New client')}
          className="rounded-md border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-1.5 text-sm hover:border-[var(--acc)]"
        >
          + Client
        </button>

        <div className="flex gap-1.5">
          <button
            onClick={() => downloadJson(useStudio.getState().exportAll(), 'bike-fit-studio')}
            title="Download every client and your branding as one readable JSON file"
            className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-sm text-[var(--text-2)] hover:border-[var(--acc)] hover:text-[var(--foreground)]"
          >
            Export all
          </button>
          <button
            onClick={() => importInput.current?.click()}
            className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-sm text-[var(--text-2)] hover:border-[var(--acc)] hover:text-[var(--foreground)]"
          >
            Import
          </button>
          <input
            ref={importInput} type="file" accept="application/json,.json" className="hidden"
            onChange={(e) => void onImport(e.target.files?.[0])}
          />
        </div>
      </div>
      {logoError && (
        <p className="mx-auto max-w-6xl px-4 pb-2 text-xs text-[var(--status-warning)]">{logoError}</p>
      )}
    </header>
  );
}

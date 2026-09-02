'use client';

import { useEffect, useMemo } from 'react';
import { deg, mm, toRad, type BbPoint } from '@/domain/units';
import { resolveCockpit } from '@/engine/assumptions';
import { decomposeHood, type HoodDecomposition, type HoodTerm } from '@/engine/forward';
import type { ModelRecommendation } from '@/engine/recommend';
import type { FrameEvaluation } from '@/engine/score';
import type { ReferenceBike } from '@/state/studio';
import { useCockpitDuel, type DuelCockpit } from '@/state/cockpitDuel';
import { useOverlaySelection } from '@/state/overlaySelection';
import { makeProjection } from '@/lib/projection';
import { Range } from './controls';

const COLOR_A = 'var(--series-1)';
const COLOR_B = 'var(--series-2)';

/** Δ above this many mm is called out - the point where it stops being noise. */
const NOTABLE_MM = 3;

const roundTerm = (t: HoodTerm): HoodTerm => ({
  reach: Math.round(t.reach), stack: Math.round(t.stack),
});

/**
 * Round every contribution to the millimetre and make the total the sum of
 * those rounded parts, so the four rows always add up to "At the hoods" on
 * screen. The unrounded hood is within half a millimetre and is what the rest
 * of the app shows.
 */
function roundedDecomp(d: HoodDecomposition) {
  const frame = roundTerm(d.frame);
  const stem = roundTerm(d.stem);
  const spacer = roundTerm(d.spacer);
  const handlebar = roundTerm(d.handlebar);
  return {
    frame, stem, spacer, handlebar,
    hood: {
      reach: frame.reach + stem.reach + spacer.reach + handlebar.reach,
      stack: frame.stack + stem.stack + spacer.stack + handlebar.stack,
    },
  };
}
type RoundedDecomp = ReturnType<typeof roundedDecomp>;

type Flat = { model: string; frame: ModelRecommendation['allSizes'][number]['frame']; evaluation: FrameEvaluation };

export function CockpitDuel({
  models, target, referenceBike,
}: {
  models: ReadonlyArray<ModelRecommendation>;
  target: BbPoint | null;
  referenceBike: ReferenceBike | null;
}) {
  const flat = useMemo<Flat[]>(
    () => models.flatMap((m) => m.allSizes.map((s) => ({ model: m.model, ...s }))),
    [models],
  );

  // Which two frames are in play is the shared comparison selection, so a pick
  // made on Compare or Matrix is already here (and vice versa). Slot A is
  // selection[0], slot B is selection[1].
  const selectedIds = useOverlaySelection((s) => s.selectedIds);
  const setAt = useOverlaySelection((s) => s.setAt);
  const seedIfEmpty = useOverlaySelection((s) => s.seedIfEmpty);
  const cockpits = useCockpitDuel((s) => s.cockpits);
  const setCockpit = useCockpitDuel((s) => s.setCockpit);
  const seedCockpit = useCockpitDuel((s) => s.seedCockpit);

  // If the fitter opened Cockpit before ever visiting Compare, seed the shared
  // selection from the top recommendations so both slots have a bike.
  useEffect(() => {
    if (models.length > 0) seedIfEmpty(models.slice(0, 3).map((m) => m.best.frame.id));
  }, [models, seedIfEmpty]);

  const has = (id: string | null | undefined) => !!id && flat.some((f) => f.frame.id === id);
  const idA = has(selectedIds[0]) ? selectedIds[0]! : flat[0]?.frame.id ?? null;
  const idB = has(selectedIds[1])
    ? selectedIds[1]!
    : flat.find((f) => f.frame.id !== idA)?.frame.id ?? idA ?? null;

  const bikeA = flat.find((f) => f.frame.id === idA);
  const bikeB = flat.find((f) => f.frame.id === idB);

  const barSeed = useMemo(
    () => ({ barReach: referenceBike?.barReach ?? 80, barRise: referenceBike?.barRise ?? 0 }),
    [referenceBike],
  );

  const recommendedFor = useMemo(
    () => (b: Flat): DuelCockpit => ({
      stemLength: Math.round(b.evaluation.built.stemLength / 5) * 5,
      stemAngle: Math.round(b.evaluation.built.stemAngle),
      spacerHeight: Math.round(b.evaluation.built.spacerHeight / 2.5) * 2.5,
      ...barSeed,
    }),
    [barSeed],
  );

  // Seed the selected bikes' cockpits (idempotent - seedCockpit only fills a gap).
  useEffect(() => {
    for (const b of [bikeA, bikeB]) if (b) seedCockpit(b.frame.id, recommendedFor(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idA, idB, flat, recommendedFor]);

  if (!bikeA || !bikeB || idA === null || idB === null) {
    return (
      <p className="rounded-[10px] border border-dashed border-[var(--border)] bg-[var(--panel)] px-4 py-8 text-center text-sm text-[var(--text-3)]">
        Add a frame in the Bikes tab first.
      </p>
    );
  }

  const cockpitA = cockpits[idA] ?? recommendedFor(bikeA);
  const cockpitB = cockpits[idB] ?? recommendedFor(bikeB);

  const decomp = (b: Flat, c: DuelCockpit): HoodDecomposition =>
    decomposeHood(
      { stack: mm(b.frame.stack), reach: mm(b.frame.reach), headTubeAngle: deg(b.frame.headTubeAngle) },
      resolveCockpit({
        stemLength: mm(c.stemLength), stemAngle: deg(c.stemAngle), spacerHeight: mm(c.spacerHeight),
        barReach: mm(c.barReach), barRise: mm(c.barRise),
      }),
    );

  const dA = decomp(bikeA, cockpitA);
  const dB = decomp(bikeB, cockpitB);
  const rA = roundedDecomp(dA);
  const rB = roundedDecomp(dB);

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-3)]">
        Pick two bikes, build each one, and read off where the hood difference actually comes from —
        the frame, the stem, the spacers or the bar. Each cockpit is kept while you switch bikes or tabs.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <BikePanel
          slot="A" color={COLOR_A} flat={flat} bike={bikeA} cockpit={cockpitA} target={target}
          hood={rA.hood}
          onPick={(id) => setAt(0, id)}
          onChange={(patch) => setCockpit(idA, patch)}
          onReset={() => setCockpit(idA, recommendedFor(bikeA))}
        />
        <BikePanel
          slot="B" color={COLOR_B} flat={flat} bike={bikeB} cockpit={cockpitB} target={target}
          hood={rB.hood}
          onPick={(id) => setAt(1, id)}
          onChange={(patch) => setCockpit(idB, patch)}
          onReset={() => setCockpit(idB, recommendedFor(bikeB))}
        />
      </div>

      <ContributionTable
        a={rA} b={rB}
        labelA={`${bikeA.model} ${bikeA.frame.size}`}
        labelB={`${bikeB.model} ${bikeB.frame.size}`}
      />

      <CockpitZoom
        a={{ decomp: dA, frame: bikeA.frame, color: COLOR_A, label: `${bikeA.model} ${bikeA.frame.size}` }}
        b={{ decomp: dB, frame: bikeB.frame, color: COLOR_B, label: `${bikeB.model} ${bikeB.frame.size}` }}
      />
    </div>
  );
}

// --- bike panel -----------------------------------------------------------

function BikePanel({
  slot, color, flat, bike, cockpit, hood, target, onPick, onChange, onReset,
}: {
  slot: 'A' | 'B';
  color: string;
  flat: Flat[];
  bike: Flat;
  cockpit: DuelCockpit;
  hood: HoodTerm;
  target: BbPoint | null;
  onPick: (id: string) => void;
  onChange: (patch: Partial<DuelCockpit>) => void;
  onReset: () => void;
}) {
  const dev = target
    ? { reach: hood.reach - target.x, stack: hood.stack - target.y }
    : null;

  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-5 w-5 place-items-center rounded text-[11px] font-bold text-black"
          style={{ background: color }}>{slot}</span>
        <select
          value={bike.frame.id}
          onChange={(e) => onPick(e.target.value)}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 text-sm"
        >
          {flat.map((s) => (
            <option key={s.frame.id} value={s.frame.id}>
              {s.model} {s.frame.size} — score {s.evaluation.composite.toFixed(0)}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Range label="Stem length" unit="mm" v={cockpit.stemLength} min={60} max={140} step={5} onChange={(v) => onChange({ stemLength: v })} />
        <Range label="Stem angle" unit="°" v={cockpit.stemAngle} min={-17} max={17} step={1} onChange={(v) => onChange({ stemAngle: v })} />
        <Range label="Spacers" unit="mm" v={cockpit.spacerHeight} min={0} max={50} step={2.5} onChange={(v) => onChange({ spacerHeight: v })} />
        <Range label="Bar reach" unit="mm" v={cockpit.barReach} min={65} max={100} step={1} onChange={(v) => onChange({ barReach: v })} />
        <Range label="Bar rise" unit="mm" v={cockpit.barRise} min={0} max={40} step={1} onChange={(v) => onChange({ barRise: v })} />
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
        <span className="text-[var(--text-3)]">At the hoods</span>
        <span className="tabular font-semibold">
          {hood.reach} × {hood.stack} mm
        </span>
        {dev && (
          <span className="tabular text-[var(--text-3)]">
            vs target {dev.reach >= 0 ? '+' : ''}{dev.reach.toFixed(0)} / {dev.stack >= 0 ? '+' : ''}{dev.stack.toFixed(0)}
          </span>
        )}
        <button onClick={onReset}
          className="ml-auto rounded-md border border-[var(--border)] px-2 py-0.5 text-[var(--text-2)] hover:border-[var(--acc)] hover:text-[var(--foreground)]">
          Reset to recommended
        </button>
      </div>
    </div>
  );
}

// --- contribution table -------------------------------------------------

function ContributionTable({
  a, b, labelA, labelB,
}: { a: RoundedDecomp; b: RoundedDecomp; labelA: string; labelB: string }) {
  const rows: ReadonlyArray<{ label: string; a: HoodTerm; b: HoodTerm; total?: boolean }> = [
    { label: 'Frame reach / stack', a: a.frame, b: b.frame },
    { label: 'Stem  ( L·cos θ, L·sin θ )', a: a.stem, b: b.stem },
    { label: 'Spacers + headset  ( −h·cos hta, h·sin hta )', a: a.spacer, b: b.spacer },
    { label: 'Handlebar + hoods', a: a.handlebar, b: b.handlebar },
    { label: 'At the hoods', a: a.hood, b: b.hood, total: true },
  ];

  return (
    <div className="overflow-x-auto rounded-[10px] border border-[var(--border)]">
      <table className="tabular w-full min-w-[46rem] text-sm">
        <thead className="bg-[var(--panel-2)] text-[11px] uppercase tracking-wider text-[var(--text-3)]">
          <tr>
            <th className="px-3 py-2 text-left">Contribution</th>
            <th className="px-2 py-2 text-right" colSpan={2}>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: COLOR_A }} />{labelA}
              </span>
            </th>
            <th className="px-2 py-2 text-right" colSpan={2}>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: COLOR_B }} />{labelB}
              </span>
            </th>
            <th className="px-2 py-2 text-right" colSpan={2}>Δ (B − A)</th>
          </tr>
          <tr className="text-[10px]">
            <th />
            <th className="px-2 py-1 text-right font-normal">reach</th>
            <th className="px-2 py-1 text-right font-normal">stack</th>
            <th className="px-2 py-1 text-right font-normal">reach</th>
            <th className="px-2 py-1 text-right font-normal">stack</th>
            <th className="px-2 py-1 text-right font-normal">reach</th>
            <th className="px-2 py-1 text-right font-normal">stack</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const dReach = r.b.reach - r.a.reach;
            const dStack = r.b.stack - r.a.stack;
            return (
              <tr key={r.label}
                className={`border-t border-[var(--border)] ${r.total ? 'border-t-2 border-t-[var(--text-3)] font-semibold' : ''}`}>
                <td className="px-3 py-2 text-left">{r.label}</td>
                <td className="px-2 py-2 text-right">{fmt(r.a.reach)}</td>
                <td className="px-2 py-2 text-right">{fmt(r.a.stack)}</td>
                <td className="px-2 py-2 text-right">{fmt(r.b.reach)}</td>
                <td className="px-2 py-2 text-right">{fmt(r.b.stack)}</td>
                <DeltaCell v={dReach} />
                <DeltaCell v={dStack} />
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-3 py-2 text-[11px] text-[var(--text-3)]">
        The four rows above sum, to the millimetre, to “At the hoods”. A Δ over {NOTABLE_MM} mm is
        highlighted — that is where the difference lives, and what it costs to change.
      </p>
    </div>
  );
}

function DeltaCell({ v }: { v: number }) {
  const notable = Math.abs(v) > NOTABLE_MM;
  return (
    <td
      className={`px-2 py-2 text-right ${notable ? 'font-semibold' : 'text-[var(--text-3)]'}`}
      style={notable ? { color: 'var(--status-warning)' } : undefined}
    >
      {v >= 0 ? '+' : ''}{v.toFixed(0)}
    </td>
  );
}

const fmt = (n: number) => (n >= 0 ? '' : '−') + Math.abs(n).toFixed(0);

// --- zoomed cockpit drawing -------------------------------------------

interface ZoomBike {
  decomp: HoodDecomposition;
  frame: Flat['frame'];
  color: string;
  label: string;
}

function CockpitZoom({ a, b }: { a: ZoomBike; b: ZoomBike }) {
  const htBotOf = (z: ZoomBike): BbPoint => {
    const ht = z.frame.headTubeLength ?? mm(100);
    const hta = toRad(z.frame.headTubeAngle);
    const top = z.decomp.points.headTubeTop;
    return { x: mm(top.x + ht * Math.cos(hta)), y: mm(top.y - ht * Math.sin(hta)) };
  };

  const bikes = [a, b];
  const allPts: BbPoint[] = bikes.flatMap((z) => [
    htBotOf(z), z.decomp.points.headTubeTop, z.decomp.points.steererTop,
    z.decomp.points.clamp, z.decomp.points.hood,
  ]);
  const xs = allPts.map((p) => p.x);
  const ys = allPts.map((p) => p.y);
  const m = 16;
  const bounds = {
    minX: Math.min(...xs) - m, maxX: Math.max(...xs) + m,
    minY: Math.min(...ys) - m, maxY: Math.max(...ys) + m,
  };
  // Size the canvas to the drawing so a uniform mm scale leaves no dead space.
  const PAD = 20;
  const PPMM = 2.6;
  const W = (bounds.maxX - bounds.minX) * PPMM + PAD * 2;
  const H = (bounds.maxY - bounds.minY) * PPMM + PAD * 2;
  const proj = makeProjection(bounds, W, H, PAD);
  const X = (p: BbPoint) => proj.toSvgX(p.x);
  const Y = (p: BbPoint) => proj.toSvgY(p.y);

  const someSchematic = bikes.some((z) => z.frame.headTubeLength === undefined);

  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--panel)] p-2">
      <h3 className="px-1 pb-1 text-xs font-semibold uppercase tracking-widest text-[var(--text-3)]">
        Cockpit, zoomed — head tube, spacers, stem, bar
      </h3>
      <div className="overflow-x-auto">
        <svg viewBox={proj.viewBox} role="img"
          aria-label="The two cockpits drawn to scale and overlaid at the bottom bracket"
          className="mx-auto block w-full" style={{ minWidth: 360, maxHeight: 440 }}>
          {bikes.map((z, i) => {
            const p = z.decomp.points;
            const htBot = htBotOf(z);
            const seg = (from: BbPoint, to: BbPoint, width: number, dash?: boolean) => (
              <line x1={X(from)} y1={Y(from)} x2={X(to)} y2={Y(to)}
                stroke={z.color} strokeWidth={width} strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                strokeDasharray={dash ? '4 3' : undefined} />
            );
            return (
              <g key={i}>
                {seg(htBot, p.headTubeTop, 4)}
                {seg(p.headTubeTop, p.steererTop, 2.5)}
                {seg(p.steererTop, p.clamp, 2.5)}
                {seg(p.clamp, p.hood, 1.75, true)}
                <circle cx={X(p.headTubeTop)} cy={Y(p.headTubeTop)} r={3}
                  fill="var(--panel)" stroke={z.color} strokeWidth={2} />
                <circle cx={X(p.hood)} cy={Y(p.hood)} r={4.5} fill={z.color}
                  stroke="var(--panel)" strokeWidth={1.5} />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] text-[var(--text-3)]">
        {bikes.map((z, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: z.color }} />{z.label}
          </span>
        ))}
        <span>ring: head tube top · dot: hoods · dashed: bar reach</span>
        {someSchematic && <span>head tube length not in the data for one frame — drawn at a typical 100 mm</span>}
      </div>
    </div>
  );
}

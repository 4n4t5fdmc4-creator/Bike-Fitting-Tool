'use client';

import { useState } from 'react';
import { deg, mm, type BbPoint } from '@/domain/units';
import { gripPoint } from '@/engine/forward';
import { resolveCockpit } from '@/engine/assumptions';
import { compare } from '@/engine/phrases';

export interface CockpitFrame {
  readonly stack: number;
  readonly reach: number;
  readonly headTubeAngle: number;
  readonly maxSpacerStack: number;
}

/**
 * Live cockpit exploration for one frame: drag the parts, watch the hood
 * position move. This is the "what if" tool - direct manipulation builds the
 * intuition that a table of numbers does not.
 */
export function CockpitExplorer({
  frame,
  target,
  initialStem = 100,
  initialAngle = -6,
  initialSpacers = 20,
  initialBarReach = 80,
  initialBarRise = 0,
}: {
  frame: CockpitFrame;
  target: BbPoint | null;
  initialStem?: number;
  initialAngle?: number;
  initialSpacers?: number;
  initialBarReach?: number;
  initialBarRise?: number;
}) {
  const [stemLength, setStemLength] = useState(initialStem);
  const [stemAngle, setStemAngle] = useState(initialAngle);
  const [spacers, setSpacers] = useState(initialSpacers);
  const [barReach, setBarReach] = useState(initialBarReach);
  const [barRise, setBarRise] = useState(initialBarRise);

  const cockpit = resolveCockpit({
    stemLength: mm(stemLength), stemAngle: deg(stemAngle), spacerHeight: mm(spacers),
    barReach: mm(barReach), barRise: mm(barRise),
  });
  const grip = gripPoint(
    { stack: mm(frame.stack), reach: mm(frame.reach), headTubeAngle: deg(frame.headTubeAngle) },
    cockpit,
  );

  const dev = target ? { x: grip.x - target.x, y: grip.y - target.y } : null;
  const cmp = dev ? compare(dev.x, dev.y) : null;
  const overSpacers = spacers > frame.maxSpacerStack;

  return (
    <div className="rounded-[10px] border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider label="Stem length" unit="mm" value={stemLength} min={60} max={140} step={5} onChange={setStemLength} />
        <Slider label="Stem angle" unit="°" value={stemAngle} min={-17} max={17} step={1} onChange={setStemAngle} />
        <Slider
          label="Spacers" unit="mm" value={spacers} min={0} max={50} step={2.5} onChange={setSpacers}
          {...(overSpacers ? { warn: `past this frame's ${frame.maxSpacerStack} mm limit` } : {})}
        />
        <Slider label="Bar reach" unit="mm" value={barReach} min={65} max={100} step={1} onChange={setBarReach} />
        <Slider label="Bar rise" unit="mm" value={barRise} min={0} max={40} step={1} onChange={setBarRise} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-md bg-[var(--panel-2)] p-3 sm:grid-cols-4">
        <Readout label="Hoods ahead of BB" value={`${grip.x.toFixed(0)} mm`} />
        <Readout label="Hoods above BB" value={`${grip.y.toFixed(0)} mm`} />
        {dev && cmp ? (
          <>
            <Readout
              label="vs. target"
              value={Math.abs(dev.x) < 3 && Math.abs(dev.y) < 3 ? 'on target' : cmp.precise}
              accent={Math.abs(dev.x) < 12 && Math.abs(dev.y) < 18 ? 'good' : 'warn'}
            />
            <Readout label="Deviation" value={`${dev.x >= 0 ? '+' : ''}${dev.x.toFixed(0)} / ${dev.y >= 0 ? '+' : ''}${dev.y.toFixed(0)} mm`} />
          </>
        ) : (
          <Readout label="vs. target" value="no target set" />
        )}
      </div>
      {overSpacers && (
        <p className="mt-2 text-xs text-[var(--status-warning)]">
          ⚠ {spacers} mm of spacers is past this frame&apos;s {frame.maxSpacerStack} mm limit — a
          steerer limit, not a matter of preference.
        </p>
      )}
    </div>
  );
}

const roundToStep = (v: number, step: number): number => Math.round(v / step) * step;

function Slider({
  label, unit, value, min, max, step, onChange, warn,
}: {
  label: string; unit: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; warn?: string;
}) {
  return (
    <label className="block text-xs">
      <span className="flex items-baseline justify-between">
        <span className="text-[var(--text-2)]">{label}</span>
        {/* Display only ever shows what the slider's own step resolves to -
            never the raw float a recommended build starts from. */}
        <span className="tabular font-semibold">{roundToStep(value, step)} {unit}</span>
      </span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 w-full accent-[var(--acc)]"
      />
      {warn && <span className="mt-0.5 block text-[11px] text-[var(--status-warning)]">{warn}</span>}
    </label>
  );
}

function Readout({ label, value, accent }: { label: string; value: string; accent?: 'good' | 'warn' }) {
  const color = accent === 'good' ? 'var(--status-good)' : accent === 'warn' ? 'var(--status-warning)' : undefined;
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-3)]">{label}</div>
      <div className="tabular mt-0.5 text-sm font-semibold" style={color ? { color } : undefined}>{value}</div>
    </div>
  );
}

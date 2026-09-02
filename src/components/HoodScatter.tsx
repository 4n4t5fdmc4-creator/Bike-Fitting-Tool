'use client';

import { useMemo } from 'react';
import { makeProjection, withMinAspect } from '@/lib/projection';
import { modelColorMap } from '@/lib/modelColors';
import type { FitTolerance } from '@/lib/fitRadius';
import type { FitMode } from '@/state/comparisonMode';
import { PlotTooltip } from './PlotTooltip';

/**
 * Where the hands actually end up: hood grip X against hood grip Y, both
 * BB-relative, after the cockpit is applied. The sister view to the stack/reach
 * scatter - that one stops at the frame, this one carries on through stem,
 * spacers and bar to the grip.
 *
 * Overlay: a target window rectangle from the same four tolerances, drawn
 * around the reference hood position and labelled with the asymmetry. In
 * `as-fitted` every bike is built to its target, so the dots collapse onto the
 * reference; in `same-cockpit` they fan out by how the frames differ.
 */

const PAD = 48;
const PPMM = 5.2;
/** Minimum width-to-height of the plot box. See withMinAspect. */
const MIN_ASPECT = 1.15;

interface HoodPoint {
  id: string;
  model: string;
  size: string;
  x: number;
  y: number;
}

export function HoodScatter({
  points, reference, referenceMarker, referenceLabel, tol, labelledIds, mode, anchorIsEstimated,
  hoveredId = null, onHover, pinnedIds,
}: {
  points: ReadonlyArray<HoodPoint>;
  /** Window centre - the reference hood position (target grip). */
  reference: { x: number; y: number };
  /** The reference bike's own hood in the current mode, or null when estimated. */
  referenceMarker: { x: number; y: number } | null;
  referenceLabel: string;
  tol: FitTolerance;
  labelledIds: ReadonlySet<string>;
  mode: FitMode;
  anchorIsEstimated?: boolean | undefined;
  /** Shared with the table and the stack/reach plot - see StackReachScatter. */
  hoveredId?: string | null;
  onHover?: (id: string | null) => void;
  pinnedIds?: ReadonlySet<string>;
}) {
  const models = useMemo(() => [...new Set(points.map((p) => p.model))], [points]);
  const colorOf = useMemo(() => modelColorMap(models), [models]);

  // Window edges: shorter/lower get xs/yl, longer/higher get xl/yh.
  const win = {
    left: reference.x - tol.xs,
    right: reference.x + tol.xl,
    bottom: reference.y - tol.yl,
    top: reference.y + tol.yh,
  };

  const bounds = useMemo(() => {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    if (referenceMarker) { xs.push(referenceMarker.x); ys.push(referenceMarker.y); }
    return withMinAspect({
      minX: Math.min(...xs, win.left) - 8,
      maxX: Math.max(...xs, win.right) + 8,
      minY: Math.min(...ys, win.bottom) - 8,
      maxY: Math.max(...ys, win.top) + 8,
    }, MIN_ASPECT);
  }, [points, referenceMarker, win.left, win.right, win.bottom, win.top]);

  const W = (bounds.maxX - bounds.minX) * PPMM + PAD * 2;
  const H = (bounds.maxY - bounds.minY) * PPMM + PAD * 2;
  const proj = makeProjection(bounds, W, H, PAD);
  const x = (mmX: number) => proj.toSvgX(mmX);
  const y = (mmY: number) => proj.toSvgY(mmY);

  const cx = x(reference.x);
  const cy = y(reference.y);
  const plotLeft = x(bounds.minX);
  const plotRight = x(bounds.maxX);
  const plotTop = y(bounds.maxY);
  const plotBottom = y(bounds.minY);

  const ticks = (lo: number, hi: number, step: number) => {
    const out: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
    return out;
  };
  const xTicks = ticks(bounds.minX, bounds.maxX, 10);
  const yTicks = ticks(bounds.minY, bounds.maxY, 10);

  if (points.length === 0) return null;

  const winL = x(win.left);
  const winR = x(win.right);
  const winT = y(win.top);
  const winB = y(win.bottom);

  return (
    <div>
      <div className="overflow-x-auto">
        <svg viewBox={proj.viewBox} role="img"
          aria-label="Hood grip position, X against Y, both relative to the bottom bracket, with a target window around the reference"
          className="mx-auto block w-full" style={{ minWidth: 520, maxHeight: 760 }}>
          <title>Hood position with target window</title>

          <rect x={plotLeft} y={plotTop} width={plotRight - plotLeft} height={plotBottom - plotTop}
            fill="none" stroke="var(--border)" strokeWidth={1} />
          {xTicks.map((v) => (
            <g key={`xt${v}`}>
              <line x1={x(v)} y1={plotBottom} x2={x(v)} y2={plotBottom + 4} stroke="var(--text-3)" strokeWidth={1} />
              <text x={x(v)} y={plotBottom + 15} textAnchor="middle" fontSize={10} fill="var(--text-3)">{v}</text>
            </g>
          ))}
          {yTicks.map((v) => (
            <g key={`yt${v}`}>
              <line x1={plotLeft - 4} y1={y(v)} x2={plotLeft} y2={y(v)} stroke="var(--text-3)" strokeWidth={1} />
              <text x={plotLeft - 7} y={y(v) + 3} textAnchor="end" fontSize={10} fill="var(--text-3)">{v}</text>
            </g>
          ))}
          <text x={(plotLeft + plotRight) / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--text-2)">
            Hood X, from BB (mm)
          </text>
          <text x={14} y={(plotTop + plotBottom) / 2} fontSize={11} fill="var(--text-2)"
            transform={`rotate(-90 14 ${(plotTop + plotBottom) / 2})`} textAnchor="middle">
            Hood Y, from BB (mm)
          </text>

          {/* target window */}
          <rect x={winL} y={winT} width={winR - winL} height={winB - winT}
            fill="var(--status-good)" fillOpacity={0.12}
            stroke="var(--status-good)" strokeOpacity={0.7} strokeWidth={1} />
          <text x={winL} y={winT - 14} fontSize={10} fontWeight={600} fill="var(--status-good)"
            stroke="var(--panel)" strokeWidth={3} paintOrder="stroke" style={{ paintOrder: 'stroke' }}>
            target window: −{tol.xs} / +{tol.xl} in reach
          </text>
          <text x={winL} y={winT - 3} fontSize={10} fill="var(--text-3)"
            stroke="var(--panel)" strokeWidth={3} paintOrder="stroke" style={{ paintOrder: 'stroke' }}>
            −{tol.yl} / +{tol.yh} in stack
          </text>

          {/* reference crosshair */}
          <line x1={plotLeft} y1={cy} x2={plotRight} y2={cy}
            stroke="var(--text-2)" strokeWidth={1} strokeDasharray="2 3" opacity={0.7} />
          <line x1={cx} y1={plotTop} x2={cx} y2={plotBottom}
            stroke="var(--text-2)" strokeWidth={1} strokeDasharray="2 3" opacity={0.7} />

          {/* one dot per size, with a hit area wider than the mark */}
          {points.map((p) => {
            const on = hoveredId === p.id;
            const pinned = pinnedIds?.has(p.id) ?? false;
            const labelled = labelledIds.has(p.id) || pinned;
            return (
              <g key={p.id}>
                {(on || pinned) && (
                  <circle cx={x(p.x)} cy={y(p.y)} r={on ? 10 : 8}
                    fill="none" stroke={colorOf(p.model)} strokeWidth={on ? 2 : 1.5}
                    opacity={on ? 0.9 : 0.55} />
                )}
                <circle cx={x(p.x)} cy={y(p.y)} r={on ? 6 : 4} fill={colorOf(p.model)}
                  stroke="var(--panel)" strokeWidth={on ? 1.5 : 1} />
                {labelled && (
                  <text x={x(p.x) + 7} y={y(p.y) - 6} fontSize={10} fontWeight={600}
                    fill="var(--foreground)" stroke="var(--panel)" strokeWidth={3}
                    paintOrder="stroke" style={{ paintOrder: 'stroke' }}>
                    {p.model} {p.size}
                  </text>
                )}
                <circle
                  cx={x(p.x)} cy={y(p.y)} r={11} fill="transparent"
                  style={{ cursor: onHover ? 'pointer' : 'default' }}
                  onMouseEnter={() => onHover?.(p.id)}
                  onMouseLeave={() => onHover?.(null)}
                />
              </g>
            );
          })}

          {/* reference bike marker */}
          {referenceMarker && (
            <>
              <path
                d={`M ${x(referenceMarker.x)} ${y(referenceMarker.y) - 6} L ${x(referenceMarker.x) + 6} ${y(referenceMarker.y)} L ${x(referenceMarker.x)} ${y(referenceMarker.y) + 6} L ${x(referenceMarker.x) - 6} ${y(referenceMarker.y)} Z`}
                fill="var(--panel)" stroke="var(--foreground)" strokeWidth={1.5} />
              <text x={x(referenceMarker.x) + 9} y={y(referenceMarker.y) + 14} fontSize={10} fontWeight={600}
                fill="var(--foreground)" stroke="var(--panel)" strokeWidth={3} paintOrder="stroke"
                style={{ paintOrder: 'stroke' }}>
                {referenceLabel}
              </text>
            </>
          )}

          {/* hover readout, last so nothing draws over it */}
          {(() => {
            const p = points.find((q) => q.id === hoveredId);
            if (!p) return null;
            const sign = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(0)}`;
            return (
              <PlotTooltip
                x={x(p.x)} y={y(p.y)}
                title={`${p.model} ${p.size}`}
                color={colorOf(p.model)}
                lines={[
                  `hood ${p.x.toFixed(0)} × ${p.y.toFixed(0)} mm from the BB`,
                  `Δ ${sign(p.x - reference.x)} reach · ${sign(p.y - reference.y)} stack`,
                  mode === 'as-fitted' ? 'built to its own target' : 'on the shared cockpit',
                ]}
                bounds={{ left: 0, right: W, top: 0, bottom: H }}
              />
            );
          })()}
        </svg>
      </div>

      {/* Grouped like the stack/reach legend: model identity and the tolerance
          window are different kinds of thing and must not look alike. */}
      <div className="mt-1 flex flex-wrap items-start gap-x-6 gap-y-2 px-1 text-[11px] text-[var(--text-3)]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="uppercase tracking-wider">Models</span>
          {models.map((m) => (
            <span key={m} className="flex items-center gap-1.5 text-[var(--text-2)]">
              <span className="h-2 w-2 rounded-full" style={{ background: colorOf(m) }} />
              {m}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="uppercase tracking-wider">Around the target</span>
          <span className="flex items-center gap-1.5 text-[var(--text-2)]">
            <span
              className="h-2.5 w-4 rounded-[2px] border"
              style={{
                background: 'color-mix(in srgb, var(--status-good) 26%, transparent)',
                borderColor: 'var(--status-good)',
              }}
            />
            target window
          </span>
          <span>
            {mode === 'as-fitted'
              ? 'each bike built to its own target'
              : 'every bike on the shared cockpit'}
            {anchorIsEstimated ? ' · window around an estimated position' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

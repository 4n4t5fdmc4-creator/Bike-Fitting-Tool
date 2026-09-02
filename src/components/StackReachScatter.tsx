'use client';

import { useMemo } from 'react';
import { makeProjection, withMinAspect } from '@/lib/projection';
import { withinFitRadius, type FitTolerance } from '@/lib/fitRadius';
import { modelColorMap } from '@/lib/modelColors';
import type { MatrixRow } from './MatrixTab';
import { PlotTooltip } from './PlotTooltip';

/**
 * Stack/reach scatter, drawn as inline SVG through the shared projection so it
 * sits at the same scale as every other overlay in the app (no charting
 * library - docs/app-architecture.md section 6.2).
 *
 * Layers, back to front:
 *  1. Asymmetric tolerance zones - four quarter-ellipses around the reference,
 *     because short/long and low/high are tolerated differently. Inner zone
 *     green, outer (2x radius) amber. Radii come straight from the four
 *     tolerance sliders, the SAME {@link FitTolerance} the table's in-radius
 *     column reads.
 *  2. Stack-to-reach isolines, dashed and recessive, labelled at the right edge.
 *  3. Dots, one per size, coloured by model, with a crosshair through the
 *     reference. Frames ticked in the Overlay tab also get a text label.
 */

const PAD = 48;
/**
 * Screen px per mm at the base scale. Only sets the plot's aspect ratio and the
 * relative size of text - the SVG itself scales to the container. Reach and
 * stack share it, so a 10 mm move reads the same length on either axis.
 */
const PPMM = 5.2;
const ISOLINES = [1.4, 1.45, 1.5, 1.55, 1.6] as const;
/** Minimum width-to-height of the plot box. See withMinAspect. */
const MIN_ASPECT = 1.15;

export function StackReachScatter({
  rows, reference, referenceLabel, tol, labelledIds, anchorIsEstimated,
  hoveredId = null, onHover, pinnedIds,
}: {
  rows: ReadonlyArray<MatrixRow>;
  reference: { stack: number; reach: number };
  referenceLabel: string;
  tol: FitTolerance;
  /** Frame ids to draw a text label for - the Overlay tab's current selection. */
  labelledIds: ReadonlySet<string>;
  anchorIsEstimated?: boolean | undefined;
  /**
   * The row under the pointer, wherever the pointer is. Owned by MatrixTab so
   * hovering a table row lights up its dot and hovering a dot lights up its row -
   * with forty-odd near-identical dots, finding the one you are reading about
   * was otherwise a matter of counting along an axis.
   */
  hoveredId?: string | null;
  onHover?: (id: string | null) => void;
  /** Rows clicked in the table: labelled permanently, not just while hovered. */
  pinnedIds?: ReadonlySet<string>;
}) {
  const models = useMemo(
    () => [...new Set(rows.map((r) => r.model))],
    [rows],
  );
  const colorOf = useMemo(() => modelColorMap(models), [models]);

  const bounds = useMemo(() => {
    const outerX = 2 * Math.max(tol.xs, tol.xl);
    const outerY = 2 * Math.max(tol.yl, tol.yh);
    const reaches = rows.map((r) => r.reach);
    const stacks = rows.map((r) => r.stack);
    const raw = {
      minX: Math.min(...reaches, reference.reach - outerX) - 8,
      maxX: Math.max(...reaches, reference.reach + outerX) + 8,
      minY: Math.min(...stacks, reference.stack - outerY) - 8,
      maxY: Math.max(...stacks, reference.stack + outerY) + 8,
    };
    // A size run spans far more stack than reach; left as-is the plot is a
    // portrait sliver that cannot fill a page-width container. Padding the
    // reach axis keeps the mm scale uniform and buys room for the dot labels.
    return withMinAspect(raw, MIN_ASPECT);
  }, [rows, reference, tol]);

  // Size the canvas to the data so the plot fills it - a fixed viewBox with a
  // uniform mm scale leaves a tall column of dead space when reach spans far
  // less than stack.
  const W = (bounds.maxX - bounds.minX) * PPMM + PAD * 2;
  const H = (bounds.maxY - bounds.minY) * PPMM + PAD * 2;

  const proj = makeProjection(bounds, W, H, PAD);
  const x = (mmX: number) => proj.toSvgX(mmX);
  const y = (mmY: number) => proj.toSvgY(mmY);
  const s = proj.scale;

  const cx = x(reference.reach);
  const cy = y(reference.stack);
  const plotRight = x(bounds.maxX);
  const plotLeft = x(bounds.minX);
  const plotTop = y(bounds.maxY);
  const plotBottom = y(bounds.minY);

  // Quarter-ellipse from the reference: east/south/west/north on screen.
  // sx > 0 bows right, sy > 0 bows down. Sweep flag chosen so the arc bows
  // away from the reference in that quadrant.
  const quarter = (rx: number, ry: number, sx: 1 | -1, sy: 1 | -1) => {
    const ex = cx + sx * rx;
    const ey = cy + sy * ry;
    const sweep = sx === sy ? 1 : 0;
    return `M ${cx} ${cy} L ${ex} ${cy} A ${rx} ${ry} 0 0 ${sweep} ${cx} ${ey} Z`;
  };

  // right = longer reach (xl), left = shorter (xs); up = higher stack (yh),
  // down = lower (yl). Screen y is flipped, so "up" is sy = -1.
  const zone = (mult: number) => [
    quarter(tol.xl * s * mult, tol.yh * s * mult, 1, -1),
    quarter(tol.xl * s * mult, tol.yl * s * mult, 1, 1),
    quarter(tol.xs * s * mult, tol.yh * s * mult, -1, -1),
    quarter(tol.xs * s * mult, tol.yl * s * mult, -1, 1),
  ];

  const ticks = (lo: number, hi: number, step: number) => {
    const out: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
    return out;
  };
  const xTicks = ticks(bounds.minX, bounds.maxX, 20);
  const yTicks = ticks(bounds.minY, bounds.maxY, 20);

  if (rows.length === 0) return null;

  return (
    <div>
      <div className="overflow-x-auto">
        <svg viewBox={proj.viewBox} role="img"
          aria-label="Frame stack against frame reach, one point per size, with tolerance zones around the reference"
          className="mx-auto block w-full" style={{ minWidth: 520, maxHeight: 760 }}>
          <title>Stack / reach scatter with asymmetric tolerance zones</title>

          {/* plot frame + ticks */}
          <rect x={plotLeft} y={plotTop} width={plotRight - plotLeft} height={plotBottom - plotTop}
            fill="none" stroke="var(--border)" strokeWidth={1} />
          {xTicks.map((v) => (
            <g key={`xt${v}`}>
              <line x1={x(v)} y1={plotBottom} x2={x(v)} y2={plotBottom + 4}
                stroke="var(--text-3)" strokeWidth={1} />
              <text x={x(v)} y={plotBottom + 15} textAnchor="middle" fontSize={10}
                fill="var(--text-3)">{v}</text>
            </g>
          ))}
          {yTicks.map((v) => (
            <g key={`yt${v}`}>
              <line x1={plotLeft - 4} y1={y(v)} x2={plotLeft} y2={y(v)}
                stroke="var(--text-3)" strokeWidth={1} />
              <text x={plotLeft - 7} y={y(v) + 3} textAnchor="end" fontSize={10}
                fill="var(--text-3)">{v}</text>
            </g>
          ))}
          <text x={(plotLeft + plotRight) / 2} y={H - 6} textAnchor="middle" fontSize={11}
            fill="var(--text-2)">Frame reach (mm)</text>
          <text x={14} y={(plotTop + plotBottom) / 2} fontSize={11} fill="var(--text-2)"
            transform={`rotate(-90 14 ${(plotTop + plotBottom) / 2})`} textAnchor="middle">
            Frame stack (mm)
          </text>

          {/* 1a. outer (amber) zone */}
          {zone(2).map((d, i) => (
            <path key={`o${i}`} d={d} fill="var(--status-warning)" fillOpacity={0.1}
              stroke="var(--status-warning)" strokeOpacity={0.45} strokeWidth={1} />
          ))}
          {/* 1b. inner (green) zone */}
          {zone(1).map((d, i) => (
            <path key={`i${i}`} d={d} fill="var(--status-good)" fillOpacity={0.16}
              stroke="var(--status-good)" strokeOpacity={0.6} strokeWidth={1} />
          ))}

          {/* 2. stack-to-reach isolines, labelled where each leaves the plot -
              at the right edge, or along the top when it exits there first. */}
          {ISOLINES.map((k) => {
            const exitsRight = k * bounds.maxX <= bounds.maxY;
            const label = exitsRight
              ? { lx: plotRight - 2, ly: y(k * bounds.maxX) - 3, anchor: 'end' as const }
              : { lx: x(bounds.maxY / k), ly: plotTop + 9, anchor: 'middle' as const };
            return (
              <g key={`iso${k}`}>
                <line
                  x1={x(bounds.minX)} y1={y(k * bounds.minX)}
                  x2={x(bounds.maxX)} y2={y(k * bounds.maxX)}
                  stroke="var(--text-3)" strokeWidth={1} strokeDasharray="3 4" opacity={0.5} />
                <text x={label.lx} y={label.ly} textAnchor={label.anchor} fontSize={9}
                  fill="var(--text-3)">{k.toFixed(2)}</text>
              </g>
            );
          })}

          {/* 3. reference crosshair + marker */}
          <line x1={plotLeft} y1={cy} x2={plotRight} y2={cy}
            stroke="var(--text-2)" strokeWidth={1} strokeDasharray="2 3" opacity={0.7} />
          <line x1={cx} y1={plotTop} x2={cx} y2={plotBottom}
            stroke="var(--text-2)" strokeWidth={1} strokeDasharray="2 3" opacity={0.7} />
          <path d={`M ${cx} ${cy - 6} L ${cx + 6} ${cy} L ${cx} ${cy + 6} L ${cx - 6} ${cy} Z`}
            fill="var(--panel)" stroke="var(--foreground)" strokeWidth={1.5} />
          {/* 4. one dot per size, each with a hit area far larger than the mark.
                 A 4 px dot is a coin-toss to hit with a mouse; the transparent
                 circle over it is what the pointer actually catches. No <title>
                 on it: the browser's own tooltip would arrive a second after
                 the drawn one and say the same thing twice. The table below is
                 the accessible equivalent, and it carries the pin buttons. */}
          {rows.map((r) => {
            const inR = withinFitRadius(r.deltaReach, r.deltaStack, tol);
            const on = hoveredId === r.id;
            const pinned = pinnedIds?.has(r.id) ?? false;
            return (
              <g key={r.id}>
                {(on || pinned) && (
                  <circle cx={x(r.reach)} cy={y(r.stack)} r={on ? 10 : 8}
                    fill="none" stroke={colorOf(r.model)} strokeWidth={on ? 2 : 1.5}
                    opacity={on ? 0.9 : 0.55} />
                )}
                <circle cx={x(r.reach)} cy={y(r.stack)} r={on ? 6 : inR ? 4.5 : 3.5}
                  fill={colorOf(r.model)} fillOpacity={on || inR ? 1 : 0.55}
                  stroke="var(--panel)" strokeWidth={on ? 1.5 : 1} />
                <circle
                  cx={x(r.reach)} cy={y(r.stack)} r={11} fill="transparent"
                  style={{ cursor: onHover ? 'pointer' : 'default' }}
                  onMouseEnter={() => onHover?.(r.id)}
                  onMouseLeave={() => onHover?.(null)}
                />
              </g>
            );
          })}

          {/* 5. labels last, de-collided.
              The frames worth labelling are the ones close to the reference,
              which means they are close to each other - drawn at their dots the
              names landed on top of one another and on the reference marker,
              exactly where the plot has to be readable. Nudged apart vertically
              with a leader back to the dot instead. */}
          {(() => {
            const labels = [
              {
                id: '__reference',
                text: `${referenceLabel}${anchorIsEstimated ? ' (est.)' : ''}`,
                px: cx, py: cy, bold: true,
              },
              ...rows
                .filter((r) => labelledIds.has(r.id) || pinnedIds?.has(r.id))
                .map((r) => ({
                  id: r.id,
                  text: `${r.model} ${r.size}`,
                  px: x(r.reach), py: y(r.stack), bold: false,
                })),
            ].sort((a, b) => a.py - b.py);

            const GAP = 14;
            let last = -Infinity;
            return labels.map((l) => {
              const ly = Math.max(l.py - 6, last + GAP);
              last = ly;
              const lx = l.px + 9;
              return (
                <g key={`lbl-${l.id}`}>
                  {ly - (l.py - 6) > 2 && (
                    <line x1={l.px} y1={l.py} x2={lx - 3} y2={ly - 3}
                      stroke="var(--text-3)" strokeWidth={1} opacity={0.5} />
                  )}
                  <text x={lx} y={ly} fontSize={10} fontWeight={l.bold ? 700 : 600}
                    fill="var(--foreground)" stroke="var(--panel)" strokeWidth={3}
                    paintOrder="stroke" style={{ paintOrder: 'stroke' }}>
                    {l.text}
                  </text>
                </g>
              );
            });
          })()}

          {/* 6. the hover readout, last so nothing draws over it. */}
          {(() => {
            const r = rows.find((row) => row.id === hoveredId);
            if (!r) return null;
            const sign = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(0)}`;
            return (
              <PlotTooltip
                x={x(r.reach)} y={y(r.stack)}
                title={`${r.model} ${r.size}`}
                color={colorOf(r.model)}
                lines={[
                  `stack ${r.stack.toFixed(0)} · reach ${r.reach.toFixed(0)} mm`,
                  `Δ ${sign(r.deltaStack)} stack · ${sign(r.deltaReach)} reach`,
                  withinFitRadius(r.deltaReach, r.deltaStack, tol) ? 'within tolerance' : 'outside tolerance',
                ]}
                bounds={{ left: 0, right: W, top: 0, bottom: H }}
              />
            );
          })()}
        </svg>
      </div>

      {/* Two legends, not one strip.
          Colour means two unrelated things in this plot - which model a dot
          belongs to, and whether an area is inside tolerance - and running them
          together as identical swatches asked the reader to know which green
          was which. They are now separate groups with different marks: models
          are dots, zones are bordered areas, the isoline is a dashed rule. */}
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
          <span className="uppercase tracking-wider">Around the reference</span>
          <span className="flex items-center gap-1.5 text-[var(--text-2)]">
            <span
              className="h-2.5 w-4 rounded-[2px] border"
              style={{
                background: 'color-mix(in srgb, var(--status-good) 30%, transparent)',
                borderColor: 'var(--status-good)',
              }}
            />
            in tolerance
          </span>
          <span className="flex items-center gap-1.5 text-[var(--text-2)]">
            <span
              className="h-2.5 w-4 rounded-[2px] border"
              style={{
                background: 'color-mix(in srgb, var(--status-warning) 22%, transparent)',
                borderColor: 'var(--status-warning)',
              }}
            />
            within 2×
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-0 w-4 border-t border-dashed"
              style={{ borderColor: 'var(--text-3)' }}
            />
            stack ÷ reach
          </span>
        </div>
      </div>
    </div>
  );
}

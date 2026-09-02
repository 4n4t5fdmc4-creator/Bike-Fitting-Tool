'use client';

import { deg, mm } from '@/domain/units';
import { frameOutline, outlineBounds, type FrameOutline, type OutlinePoint } from '@/engine/outline';
import { makeProjection } from '@/lib/projection';

export interface OverlayCandidate {
  readonly id: string;
  readonly label: string;
  readonly color: string;
  /** Drawn dashed and recessive; still gets a head-tube label, never a colour slot. */
  readonly isReference?: boolean;
  readonly frame: {
    stack: number; reach: number; headTubeAngle: number; seatTubeAngle: number;
    headTubeLength?: number; chainstay?: number; effectiveTopTube?: number;
    wheelbase?: number; bbDrop?: number; tyreMax?: number;
    spacerStack?: number; stemLength?: number; stemAngle?: number;
    barReach?: number; barRise?: number;
  };
}

const W = 820;
const H = 430;

/**
 * Frames superimposed to scale.
 *
 * Each tube is drawn as its own line rather than one polyline, so the shape
 * reads as a bicycle: closed front triangle, horizontal top tube, both wheels
 * on a common ground line. See engine/outline.ts for the geometry.
 *
 * Colour separates the first three frames cleanly; past that, the direct label
 * at every frame's head tube is what carries identity and colour only assists.
 *
 * Every bottom bracket sits at the origin. There was briefly a second
 * registration that stacked all the hood grips on one point instead — it drew
 * a tidy fan, but a bicycle whose bottom bracket is not where the rider's feet
 * are is not a bicycle, and nothing in the drawing could then be measured. The
 * "same hands, different bike" question it was meant to answer is answered
 * properly by the Accufit view, in millimetres.
 */
export function FrameOverlay({
  candidates,
}: {
  candidates: ReadonlyArray<OverlayCandidate>;
}) {
  const outlines: Array<{ c: OverlayCandidate; o: FrameOutline }> = candidates.map((c) => ({
    c,
    o: frameOutline({
      stack: mm(c.frame.stack),
      reach: mm(c.frame.reach),
      headTubeAngle: deg(c.frame.headTubeAngle),
      seatTubeAngle: deg(c.frame.seatTubeAngle),
      ...(c.frame.headTubeLength !== undefined ? { headTubeLength: mm(c.frame.headTubeLength) } : {}),
      ...(c.frame.chainstay !== undefined ? { chainstay: mm(c.frame.chainstay) } : {}),
      ...(c.frame.effectiveTopTube !== undefined ? { effectiveTopTube: mm(c.frame.effectiveTopTube) } : {}),
      ...(c.frame.wheelbase !== undefined ? { wheelbase: mm(c.frame.wheelbase) } : {}),
      ...(c.frame.bbDrop !== undefined ? { bbDrop: mm(c.frame.bbDrop) } : {}),
      ...(c.frame.tyreMax !== undefined ? { tyreMax: mm(c.frame.tyreMax) } : {}),
      ...(c.frame.spacerStack !== undefined ? { spacerStack: mm(c.frame.spacerStack) } : {}),
      ...(c.frame.stemLength !== undefined ? { stemLength: mm(c.frame.stemLength) } : {}),
      ...(c.frame.stemAngle !== undefined ? { stemAngle: deg(c.frame.stemAngle) } : {}),
      ...(c.frame.barReach !== undefined ? { barReach: mm(c.frame.barReach) } : {}),
      ...(c.frame.barRise !== undefined ? { barRise: mm(c.frame.barRise) } : {}),
    }),
  }));

  if (outlines.length === 0) {
    return (
      <p className="rounded-[10px] border border-dashed border-[var(--border)] bg-[var(--panel)] px-4 py-8 text-center text-sm text-[var(--text-3)]">
        Pick frames below to overlay them.
      </p>
    );
  }

  const frameBounds = outlineBounds(outlines.map((x) => x.o));
  // Reserve a right-hand gutter for the head-tube label column, so the frames
  // draw into the left of the canvas and the labels never clip the edge.
  const gutter = (frameBounds.maxX - frameBounds.minX) * 0.3;
  const proj = makeProjection({ ...frameBounds, maxX: frameBounds.maxX + gutter }, W, H);
  const labelX = proj.toSvgX(frameBounds.maxX) + 14;
  const someInexact = outlines.some((x) => !x.o.fullyExact);

  return (
    <div>
      <div className="overflow-x-auto rounded-[10px] border border-[var(--border)] bg-[var(--panel)] p-2">
        <svg viewBox={proj.viewBox} role="img" aria-label="Frame overlay" className="mx-auto block w-full"
          style={{ minWidth: 560, maxHeight: 620 }}>
          <title>Frame geometries superimposed at the bottom bracket</title>

          {outlines.map(({ c, o }) => {
            const X = (p: OutlinePoint) => proj.toSvgX(p.x);
            const Y = (p: OutlinePoint) => proj.toSvgY(p.y);
            const line = (
              a: OutlinePoint, b: OutlinePoint,
              opts: { w?: number; dash?: boolean } = {},
            ) => (
              <line
                x1={X(a)} y1={Y(a)} x2={X(b)} y2={Y(b)}
                stroke={c.color}
                strokeWidth={opts.w ?? 2.5}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                strokeDasharray={opts.dash || c.isReference ? '4 3' : undefined}
                opacity={o.fullyExact ? 1 : 0.9}
              />
            );
            const wheelR = o.wheelRadius * proj.scale;
            return (
              <g key={c.id} opacity={c.isReference ? 0.55 : 1}>
                <circle cx={X(o.rear)} cy={Y(o.rear)} r={wheelR}
                  fill="none" stroke={c.color} strokeWidth={1} opacity={0.28}
                  vectorEffect="non-scaling-stroke" />
                <circle cx={X(o.front)} cy={Y(o.front)} r={wheelR}
                  fill="none" stroke={c.color} strokeWidth={1} opacity={0.28}
                  vectorEffect="non-scaling-stroke" />

                {line(o.bb, o.rear)}
                {line(o.rear, o.stTop)}
                {line(o.bb, o.spTop)}
                {line(o.bb, o.htBot)}
                {line(o.stTop, o.htTop, { w: 1.75, dash: true })}
                {line(o.htBot, o.htTop, { w: 4 })}
                {line(o.htBot, o.front)}
                {line(o.htTop, o.spacer, { w: 2 })}
                {line(o.spacer, o.clamp, { w: 2 })}
                {line(o.clamp, o.hood, { w: 1.75, dash: true })}

                <circle cx={X(o.hood)} cy={Y(o.hood)} r={4.5}
                  fill={c.color} stroke="var(--panel)" strokeWidth={1.5} />
                <circle cx={X(o.bb)} cy={Y(o.bb)} r={3.5}
                  fill="var(--panel)" stroke={c.color} strokeWidth={2} />
              </g>
            );
          })}

          {/* Direct labels last, so they sit above every frame. Collected into
              a tidy right-hand column, each with a leader back to its head
              tube, so eight stay legible even when the head tubes bunch up. */}
          {(() => {
            const heads = outlines.map((p) => ({
              c: p.c,
              hx: proj.toSvgX(p.o.htTop.x),
              hy: proj.toSvgY(p.o.htTop.y),
            }));
            const step = 15;
            const top = Math.max(
              14,
              heads.reduce((m, h) => Math.min(m, h.hy), Infinity) -
                ((heads.length - 1) * step) / 2 - 4,
            );
            return [...heads]
              .sort((a, b) => a.hy - b.hy)
              .map((h, i) => {
                const ly = top + i * step;
                return (
                  <g key={`${h.c.id}-label`}>
                    <line x1={h.hx} y1={h.hy} x2={labelX - 4} y2={ly} stroke={h.c.color}
                      strokeWidth={1} opacity={0.6} vectorEffect="non-scaling-stroke" />
                    <circle cx={h.hx} cy={h.hy} r={2} fill={h.c.color} />
                    <text
                      x={labelX} y={ly} dominantBaseline="middle" fontSize={11}
                      fontWeight={h.c.isReference ? 400 : 600}
                      fill="var(--foreground)" stroke="var(--panel)" strokeWidth={3}
                      paintOrder="stroke" style={{ paintOrder: 'stroke' }}
                    >
                      {h.c.label}
                    </text>
                  </g>
                );
              });
          })()}
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {outlines.map(({ c, o }) => (
          <span key={c.id} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
            {c.label}
            {c.isReference && <span className="text-[var(--text-3)]">(reference)</span>}
            {!o.fullyExact && !c.isReference && <span className="text-[var(--text-3)]">(schematic)</span>}
          </span>
        ))}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-3)]">
        Every bottom bracket is at the same point. Head tube position and angle are exact, from
        stack, reach and head tube angle. The dashed
        top tube, the cockpit and the wheels use typical road-bike values where the entered geometry
        does not include effective top tube, chainstay, wheelbase or tyre clearance — this is a rough
        visual comparison, not a scale drawing.
        {someInexact && ' Frames marked "schematic" are missing effective top tube, head tube length or chainstay in their data.'}
      </p>
    </div>
  );
}

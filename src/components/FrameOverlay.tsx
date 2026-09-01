'use client';

import { deg, mm } from '@/domain/units';
import { frameOutline, outlineBounds, OUTLINE_WHEEL_RADIUS, type FrameOutline } from '@/engine/outline';
import { makeProjection } from '@/lib/projection';

export interface OverlayCandidate {
  readonly id: string;
  readonly label: string;
  readonly color: string;
  readonly frame: {
    stack: number; reach: number; headTubeAngle: number; seatTubeAngle: number;
    headTubeLength?: number; chainstay?: number;
  };
}

const W = 720;
const H = 420;

/**
 * Frames superimposed at the bottom bracket, to scale.
 *
 * Capped at three by the caller — the validated categorical palette clears the
 * all-pairs colour-difference floors for its first three slots only, verified
 * with the palette validator (docs/app-architecture.md section 6.4).
 */
export function FrameOverlay({ candidates }: { candidates: ReadonlyArray<OverlayCandidate> }) {
  const outlines: Array<{ c: OverlayCandidate; o: FrameOutline }> = candidates.map((c) => ({
    c,
    o: frameOutline({
      stack: mm(c.frame.stack),
      reach: mm(c.frame.reach),
      headTubeAngle: deg(c.frame.headTubeAngle),
      seatTubeAngle: deg(c.frame.seatTubeAngle),
      ...(c.frame.headTubeLength !== undefined ? { headTubeLength: mm(c.frame.headTubeLength) } : {}),
      ...(c.frame.chainstay !== undefined ? { chainstay: mm(c.frame.chainstay) } : {}),
    }),
  }));

  if (outlines.length === 0) {
    return (
      <p className="rounded-[10px] border border-dashed border-[var(--border)] bg-[var(--panel)] px-4 py-8 text-center text-sm text-[var(--text-3)]">
        Pick up to three frames below to overlay them.
      </p>
    );
  }

  const bounds = outlineBounds(outlines.map((x) => x.o));
  const proj = makeProjection(bounds, W, H);
  const r = OUTLINE_WHEEL_RADIUS * proj.scale;
  const someInexact = outlines.some((x) => !x.o.fullyExact);

  return (
    <div>
      <div className="overflow-x-auto rounded-[10px] border border-[var(--border)] bg-[var(--panel)] p-2">
        <svg viewBox={proj.viewBox} role="img" aria-label="Frame overlay" className="w-full" style={{ minWidth: 480 }}>
          <title>Frame geometries superimposed at the bottom bracket</title>
          {outlines.map(({ c, o }) => {
            const P = (p: { x: number; y: number }) => `${proj.toSvgX(p.x)},${proj.toSvgY(p.y)}`;
            const dash = o.fullyExact ? undefined : '1 0';
            return (
              <g key={c.id}>
                <circle cx={proj.toSvgX(o.rearAxle.x)} cy={proj.toSvgY(o.rearAxle.y)} r={r}
                  fill="none" stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                <circle cx={proj.toSvgX(o.frontAxle.x)} cy={proj.toSvgY(o.frontAxle.y)} r={r}
                  fill="none" stroke="var(--border)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
                <polyline
                  points={[o.rearAxle, o.bb, o.seatTop, o.headTop, o.headBottom, o.bb, o.frontAxle].map(P).join(' ')}
                  fill="none" stroke={c.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  strokeDasharray={dash}
                />
                <circle cx={proj.toSvgX(o.headTop.x)} cy={proj.toSvgY(o.headTop.y)} r={4.5}
                  fill={c.color} stroke="var(--panel)" strokeWidth={2} />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {outlines.map(({ c, o }) => (
          <span key={c.id} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
            {c.label}
            {!o.fullyExact && <span className="text-[var(--text-3)]">(schematic)</span>}
          </span>
        ))}
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-3)]">
        Head tube position is exact, from stack, reach and head tube angle. Seat tube, chainstay
        length and wheel position use typical road-bike defaults where the entered geometry does
        not include them — this is a rough visual comparison, not a scale drawing.
        {someInexact && ' Frames marked "schematic" are missing head tube length or chainstay in their data.'}
      </p>
    </div>
  );
}

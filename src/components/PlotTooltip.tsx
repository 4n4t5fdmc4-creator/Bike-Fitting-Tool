'use client';

/**
 * The hover readout for the Matrix plots, drawn inside the SVG.
 *
 * Inside rather than as an HTML overlay because the plots already own a
 * millimetre-to-pixel projection: a DOM tooltip would need the dot's screen
 * position, which means reading layout back out of a diagram that scales with
 * its container. In SVG user units the anchor is simply the point itself.
 *
 * Text width is estimated from the character count rather than measured. A real
 * measurement needs a layout pass, and the cost of being a few pixels wide is a
 * slightly roomy box; the cost of measuring is a reflow on every mouse move.
 */

const LINE_HEIGHT = 13;
const PAD_X = 7;
const PAD_Y = 6;
const TITLE_SIZE = 11;
const BODY_SIZE = 10;

/** Rough advance width per character, in user units, for the sizes used here. */
const widthOf = (text: string, size: number) => text.length * size * 0.58;

export function PlotTooltip({
  x, y, title, lines, color, bounds,
}: {
  /** Anchor - the dot the tooltip belongs to, in SVG user units. */
  x: number;
  y: number;
  title: string;
  lines: ReadonlyArray<string>;
  /** The series colour, shown as a chip so the tooltip names its own dot. */
  color: string;
  /** Plot edges, so the box flips instead of running off the canvas. */
  bounds: { left: number; right: number; top: number; bottom: number };
}) {
  const w =
    Math.max(widthOf(title, TITLE_SIZE) + 12, ...lines.map((l) => widthOf(l, BODY_SIZE))) +
    PAD_X * 2;
  const h = PAD_Y * 2 + LINE_HEIGHT * (lines.length + 1);

  // Prefer up and to the right of the dot; flip on whichever edge is in the way.
  const flipX = x + 12 + w > bounds.right;
  const flipY = y - h - 12 < bounds.top;
  const bx = flipX ? x - 12 - w : x + 12;
  const by = flipY ? y + 12 : y - h - 12;

  return (
    <g pointerEvents="none">
      <rect
        x={bx} y={by} width={w} height={h} rx={5}
        fill="var(--panel-2)" stroke="var(--border)" strokeWidth={1}
        opacity={0.98}
      />
      <circle cx={bx + PAD_X + 3} cy={by + PAD_Y + TITLE_SIZE * 0.45} r={3.5} fill={color} />
      <text
        x={bx + PAD_X + 12} y={by + PAD_Y + TITLE_SIZE * 0.85}
        fontSize={TITLE_SIZE} fontWeight={700} fill="var(--foreground)"
      >
        {title}
      </text>
      {lines.map((l, i) => (
        <text
          key={l}
          x={bx + PAD_X}
          y={by + PAD_Y + TITLE_SIZE * 0.85 + LINE_HEIGHT * (i + 1)}
          fontSize={BODY_SIZE} fill="var(--text-2)"
        >
          {l}
        </text>
      ))}
    </g>
  );
}

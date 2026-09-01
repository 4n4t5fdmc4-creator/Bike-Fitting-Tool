'use client';

import type { FitVerdict } from '@/domain/scoring';
import type { FrameEvaluation } from '@/engine/score';
import type { Explanation } from '@/engine/explain';
import type { LibraryFrame } from '@/data/frames';

/**
 * Status colours are reserved for verdicts and always carry an icon AND a text
 * label - never colour alone. On light surfaces two of the four sit below 3:1,
 * so the pairing is the mitigation, not decoration.
 */
const VERDICT: Record<FitVerdict, { token: string; icon: string; label: string }> = {
  excellentFit: { token: '--status-good', icon: '✓', label: 'Excellent fit' },
  worksWithModerateAdjustment: { token: '--status-warning', icon: '~', label: 'Works with adjustment' },
  borderline: { token: '--status-serious', icon: '!', label: 'Borderline' },
  notRecommended: { token: '--status-critical', icon: '×', label: 'Not recommended' },
};

export function ResultCard({
  frame,
  evaluation,
  explanation,
}: {
  frame: LibraryFrame;
  evaluation: FrameEvaluation;
  explanation: Explanation;
}) {
  const v = VERDICT[evaluation.verdict];
  const colour = `var(${v.token})`;

  return (
    <li className="rounded-[10px] border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-medium">
          {frame.model} <span className="text-[var(--text-2)]">·</span> {frame.size}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ color: colour, background: `color-mix(in srgb, ${colour} 16%, transparent)` }}
        >
          {v.icon} {v.label}
        </span>
        <span className="tabular ml-auto text-sm text-[var(--text-2)]">
          {evaluation.composite.toFixed(0)}
        </span>
      </div>

      <p className="mt-2 text-sm">{explanation.verdict}</p>
      {explanation.mechanism ? (
        <p className="mt-1 text-sm text-[var(--text-2)]">{explanation.mechanism}</p>
      ) : null}
      {explanation.requirement ? (
        <p className="mt-1 text-sm text-[var(--text-2)]">{explanation.requirement}</p>
      ) : null}

      <dl className="tabular mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--text-2)]">
        <Pair k="Stack" v={`${Math.round(frame.stack)}`} />
        <Pair k="Reach" v={`${Math.round(frame.reach)}`} />
        <Pair k="Stem" v={`${Math.round(evaluation.built.stemLength)} mm`} />
        <Pair k="Angle" v={`${evaluation.built.stemAngle > 0 ? '+' : ''}${Math.round(evaluation.built.stemAngle)}°`} />
        <Pair k="Spacers" v={`${Math.round(evaluation.built.spacerHeight)} mm`} />
      </dl>
    </li>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <span>
      <span className="opacity-70">{k}</span> {v}
    </span>
  );
}

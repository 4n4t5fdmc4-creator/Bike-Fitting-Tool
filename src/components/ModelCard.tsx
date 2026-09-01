'use client';

import { useState } from 'react';
import type { FitVerdict } from '@/domain/scoring';
import type { ModelRecommendation } from '@/engine/recommend';
import { CLOSE_CALL_POINTS } from '@/engine/recommend';

const VERDICT: Record<FitVerdict, { token: string; icon: string; label: string }> = {
  excellentFit: { token: '--status-good', icon: '✓', label: 'Same position' },
  worksWithModerateAdjustment: { token: '--status-warning', icon: '~', label: 'Close, with the right parts' },
  borderline: { token: '--status-serious', icon: '!', label: 'Only at the limit' },
  notRecommended: { token: '--status-critical', icon: '×', label: 'Cannot reach it' },
};

const build = (e: ModelRecommendation['best']['evaluation']): string => {
  const a = Math.round(e.built.stemAngle);
  return `${Math.round(e.built.stemLength)} mm ${a > 0 ? '+' : ''}${a}° stem and ${Math.round(
    e.built.spacerHeight,
  )} mm of spacers`;
};

/**
 * One model, one recommended size, and what it would take.
 *
 * The runner-up size is always shown when it is close, because "54 or 56" is
 * the question people actually have, and a tool that hides the alternative is
 * just another size chart.
 */
export function ModelCard({ rec, referenceLabel }: { rec: ModelRecommendation; referenceLabel: string }) {
  const [open, setOpen] = useState(false);
  const v = VERDICT[rec.best.evaluation.verdict];
  const colour = `var(${v.token})`;
  const b = rec.best;

  return (
    <li className="rounded-[10px] border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-base font-semibold">{rec.model}</span>
        <span className="rounded-md bg-[var(--panel-2)] px-2 py-0.5 text-sm font-semibold tabular">
          size {b.frame.size}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-xs font-semibold"
          style={{ color: colour, background: `color-mix(in srgb, ${colour} 16%, transparent)` }}
        >
          {v.icon} {v.label}
        </span>
        <span className="tabular ml-auto text-sm text-[var(--text-3)]">
          {b.evaluation.composite.toFixed(0)}
        </span>
      </div>

      <p className="mt-2 text-sm">
        {b.evaluation.verdict === 'notRecommended' ? (
          <>No size of the {rec.model} reaches your position with parts worth fitting.</>
        ) : (
          <>
            <b>{rec.model} in size {b.frame.size}</b> puts you in the same position as your{' '}
            {referenceLabel}, built with a <b>{build(b.evaluation)}</b>.
          </>
        )}
      </p>

      {rec.closeCall && rec.alternative && (
        <p className="mt-2 rounded-md bg-[var(--panel-2)] px-3 py-2 text-xs text-[var(--text-2)]">
          <b className="text-[var(--foreground)]">Size {b.frame.size} or {rec.alternative.frame.size}?</b>{' '}
          Both work and they are within {CLOSE_CALL_POINTS} points, so this is a trade-off rather
          than a ranking. The {rec.alternative.frame.size} needs a {build(rec.alternative.evaluation)}.
        </p>
      )}

      <dl className="tabular mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--text-3)]">
        <span><span className="opacity-70">Stack</span> {Math.round(b.frame.stack)}</span>
        <span><span className="opacity-70">Reach</span> {Math.round(b.frame.reach)}</span>
        <span><span className="opacity-70">Hoods</span> {Math.round(b.evaluation.achieved.x)} × {Math.round(b.evaluation.achieved.y)}</span>
        <span>
          <span className="opacity-70">Off target</span>{' '}
          {Math.round(b.evaluation.deviation.reach) === 0 && Math.round(b.evaluation.deviation.stack) === 0
            ? 'exact'
            : `${Math.round(b.evaluation.deviation.reach)} / ${Math.round(b.evaluation.deviation.stack)} mm`}
        </span>
      </dl>

      <button
        onClick={() => setOpen(!open)}
        className="mt-3 text-xs text-[var(--text-3)] hover:text-[var(--foreground)]"
      >
        {open ? 'Hide' : `Show all ${rec.allSizes.length} sizes`}
      </button>

      {open && (
        <div className="mt-2 overflow-x-auto rounded-md border border-[var(--border)]">
          <table className="tabular w-full min-w-[34rem] text-xs">
            <thead className="text-left text-[var(--text-3)]">
              <tr>
                <th className="px-3 py-1.5">Size</th><th className="px-2 py-1.5 text-right">Stack</th>
                <th className="px-2 py-1.5 text-right">Reach</th><th className="px-2 py-1.5 text-right">Stem</th>
                <th className="px-2 py-1.5 text-right">Spacers</th><th className="px-2 py-1.5 text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {rec.allSizes.map((s) => (
                <tr key={s.frame.id} className="border-t border-[var(--border)]">
                  <td className="px-3 py-1.5">{s.frame.size}</td>
                  <td className="px-2 py-1.5 text-right">{Math.round(s.frame.stack)}</td>
                  <td className="px-2 py-1.5 text-right">{Math.round(s.frame.reach)}</td>
                  <td className="px-2 py-1.5 text-right">{Math.round(s.evaluation.built.stemLength)}</td>
                  <td className="px-2 py-1.5 text-right">{Math.round(s.evaluation.built.spacerHeight)}</td>
                  <td className="px-2 py-1.5 text-right">{s.evaluation.composite.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </li>
  );
}

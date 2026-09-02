'use client';

import type { TabId } from './tabs/TabNav';

/**
 * A one-line "what is still missing" strip.
 *
 * It is not a wizard - a fitter works the steps out of order. It names only the
 * gaps that make a later view lie: no reference bike means the target is a
 * guess, too few frames means the comparison has nothing to compare, nothing
 * adopted means the session will end with no record.
 *
 * Two rules keep it from becoming wallpaper, both learned from it being shown
 * on every view at all times:
 *
 *  - Every warning is a button that jumps to the view where it is fixed. A
 *    complaint you cannot act on from where you are standing is noise.
 *  - The "all good" summary appears only in step 1, where taking stock is the
 *    job. Elsewhere, silence means nothing is wrong.
 */

interface Props {
  hasReferenceBike: boolean;
  usingExamples: boolean;
  frameCount: number;
  comparedCount: number;
  /** Builds committed to the client record - what step 3 has to show. */
  decisionCount: number;
  /** Show the reassuring summary when there is nothing to warn about. */
  showSummary: boolean;
  onGoto: (tab: TabId) => void;
}

interface Note {
  tone: 'warn' | 'ok';
  text: string;
  fix?: { tab: TabId; label: string };
}

const MIN_FRAMES_TO_COMPARE = 4;

export function StepIndicator({
  hasReferenceBike, usingExamples, frameCount, comparedCount, decisionCount,
  showSummary, onGoto,
}: Props) {
  const notes: Note[] = [];

  if (!hasReferenceBike) {
    notes.push({
      tone: 'warn',
      text: 'no reference bike set — the target is estimated from body measurements',
      fix: { tab: 'profile', label: 'set one' },
    });
  }

  if (usingExamples) {
    notes.push({
      tone: 'warn',
      text: 'showing the built-in examples',
      fix: { tab: 'bikes', label: 'paste the client’s options' },
    });
  } else if (frameCount < MIN_FRAMES_TO_COMPARE) {
    notes.push({
      tone: 'warn',
      text: `only ${frameCount} frame${frameCount === 1 ? '' : 's'} in the library`,
      fix: { tab: 'bikes', label: 'add more' },
    });
  }

  if (!usingExamples && frameCount >= 2 && comparedCount < 2) {
    notes.push({
      tone: 'warn',
      text: 'fewer than two frames picked',
      fix: { tab: 'overlay', label: 'pick some' },
    });
  }

  // Nothing else is on file at the end of a session: the sliders and the
  // selection are session state. Until a build is adopted, closing the tab
  // loses the whole result.
  if (decisionCount === 0 && !usingExamples && comparedCount >= 1) {
    notes.push({
      tone: 'warn',
      text: 'nothing recorded yet — a reload would lose this session',
      fix: { tab: 'accufit', label: 'adopt a build' },
    });
  }

  if (notes.length === 0) {
    if (!showSummary) return null;
    notes.push({
      tone: 'ok',
      text: `${decisionCount} build${decisionCount === 1 ? '' : 's'} recorded${
        hasReferenceBike ? ' · measured against the client’s own bike' : ''
      }`,
    });
  }

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
      {notes.map((n) => (
        <li key={n.text} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{
              background:
                n.tone === 'ok' ? 'var(--status-good)' : 'var(--status-warning)',
            }}
          />
          <span className={n.tone === 'ok' ? 'text-[var(--text-3)]' : 'text-[var(--text-2)]'}>
            {n.text}
          </span>
          {n.fix && (
            <button
              onClick={() => onGoto(n.fix!.tab)}
              className="text-[var(--acc)] underline-offset-2 hover:underline"
            >
              {n.fix.label} →
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

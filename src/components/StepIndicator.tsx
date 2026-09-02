'use client';

/**
 * A one-line "what is still missing" strip under the tab bar.
 *
 * It is not a wizard - the tabs are already numbered and a fitter works them
 * out of order. This only names the gaps that make a later tab lie: no
 * reference bike means the target is a guess; too few frames means the
 * comparison has nothing to compare.
 */

interface Props {
  hasReferenceBike: boolean;
  usingExamples: boolean;
  frameCount: number;
  comparedCount: number;
}

interface Note {
  tone: 'warn' | 'ok';
  text: string;
}

const MIN_FRAMES_TO_COMPARE = 4;

export function StepIndicator({
  hasReferenceBike, usingExamples, frameCount, comparedCount,
}: Props) {
  const notes: Note[] = [];

  if (!hasReferenceBike) {
    notes.push({
      tone: 'warn',
      text: 'no reference bike set — the target is estimated from body measurements',
    });
  }

  if (usingExamples) {
    notes.push({
      tone: 'warn',
      text: 'showing the built-in examples — paste the client’s options in Bikes',
    });
  } else if (frameCount < MIN_FRAMES_TO_COMPARE) {
    notes.push({
      tone: 'warn',
      text: `only ${frameCount} frame${frameCount === 1 ? '' : 's'} — add more to compare`,
    });
  }

  if (!usingExamples && frameCount >= 2 && comparedCount < 2) {
    notes.push({ tone: 'warn', text: 'pick at least two frames to compare' });
  }

  if (notes.length === 0) {
    notes.push({
      tone: 'ok',
      text: hasReferenceBike
        ? `reference bike set · ${frameCount} frames loaded · ready to compare`
        : `${frameCount} frames loaded · ready to compare`,
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
        </li>
      ))}
    </ul>
  );
}

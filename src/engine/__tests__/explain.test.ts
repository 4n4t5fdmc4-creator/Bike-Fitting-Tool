import { describe, expect, it } from 'vitest';
import { deg, mm } from '../../domain/units';
import type { FrameCore } from '../forward';
import { gripPoint } from '../forward';
import { resolveCockpit } from '../assumptions';
import { evaluateFrame } from '../score';
import { explain, primaryFlag } from '../explain';

const frame = (stack: number, reach: number, hta: number): FrameCore => ({
  stack: mm(stack), reach: mm(reach), headTubeAngle: deg(hta),
});
const BASE = resolveCockpit();
const REFERENCE = frame(565, 395, 73.5);
const TARGET = gripPoint(
  REFERENCE,
  resolveCockpit({ stemLength: mm(100), stemAngle: deg(-6), spacerHeight: mm(20) }),
);

describe('clause assembly', () => {
  it('leads with the answer and names the parts', () => {
    const e = explain(evaluateFrame(REFERENCE, TARGET, BASE), '56');
    expect(e.verdict).toBe('The 56 fits you.');
    expect(e.requirement).toContain('100 mm');
    expect(e.requirement).toContain('20 mm of spacers');
  });

  it('says plainly when nothing can be done', () => {
    const e = explain(evaluateFrame(frame(660, 385, 70.5), TARGET, BASE), 'Comfort XL');
    expect(e.verdict).toBe('The Comfort XL does not fit you.');
    expect(e.consequence).toBe('No stem or spacer combination fixes this.');
    // Rule V6: a notRecommended explanation must not end in a suggestion.
    expect(e.mechanism).toContain('cannot get low enough');
  });

  it('marks a frame at the edge of its range as only just working', () => {
    const e = explain(evaluateFrame(frame(605, 412, 73.5), TARGET, BASE), '60');
    expect(e.verdict).toMatch(/only just works|works, with the right parts/);
  });

  it('never states a millimetre the rider cannot act on', () => {
    const e = explain(evaluateFrame(frame(545, 388, 73), TARGET, BASE), '54');
    const text = Object.values(e).join(' ');
    // No decimal figures anywhere in rider-facing copy.
    expect(text).not.toMatch(/\d+\.\d/);
  });
});

describe('flag priority', () => {
  it('puts structural problems ahead of comfort ones', () => {
    expect(primaryFlag(['noRoomToLower', 'requiresTooManySpacers'])).toBe(
      'requiresTooManySpacers',
    );
    expect(primaryFlag(['flippedStemRequired', 'tooRelaxed'])).toBe('tooRelaxed');
  });
  it('returns nothing when there is nothing wrong', () => {
    expect(primaryFlag([])).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';
import { FRAME_LIBRARY, MODELS } from '../frames';
import { FRAME_BOUNDS } from '../../domain/validation';

/**
 * The library ships as fact, not example. Two guarantees are enforced here so a
 * mistyped transcription cannot reach production:
 *
 *   1. every value sits inside the hard plausibility band in validation.ts;
 *   2. stack and reach rise strictly across each model's size run - the one
 *      monotonicity the purchase advice depends on.
 *
 * Seat- and head-angle trends are checked by eye against the source table: real
 * charts occasionally flatten or reverse a tenth of a degree at the largest
 * size, so they are not asserted mechanically.
 */

const within = (v: number, b: { hard: { min: number; max: number } }) => {
  expect(v).toBeGreaterThanOrEqual(b.hard.min);
  expect(v).toBeLessThanOrEqual(b.hard.max);
};

describe('every library frame is physically plausible', () => {
  it.each(FRAME_LIBRARY.map((f) => [f.id, f] as const))('%s is within the hard bounds', (_id, f) => {
    within(f.stack, FRAME_BOUNDS.stack);
    within(f.reach, FRAME_BOUNDS.reach);
    within(f.headTubeAngle, FRAME_BOUNDS.headTubeAngle);
    within(f.seatTubeAngle, FRAME_BOUNDS.seatTubeAngle);
    within(f.headTubeLength, FRAME_BOUNDS.headTubeLength);
    within(f.chainstay, FRAME_BOUNDS.chainstayLength);
    if (f.wheelbase !== undefined) within(f.wheelbase, FRAME_BOUNDS.wheelbase);
    if (f.bbDrop !== undefined) within(f.bbDrop, FRAME_BOUNDS.bbDrop);
    if (f.forkRake !== undefined) within(f.forkRake, FRAME_BOUNDS.forkRake);
    if (f.standover !== undefined) within(f.standover, FRAME_BOUNDS.standover);
  });

  it('never contradicts wheelbase against chainstay', () => {
    for (const f of FRAME_LIBRARY) {
      if (f.wheelbase !== undefined) expect(f.wheelbase).toBeGreaterThan(f.chainstay);
    }
  });
});

describe('stack and reach are monotonic across each size run', () => {
  it.each(MODELS)('%s', (model) => {
    const run = FRAME_LIBRARY.filter((f) => f.model === model);
    expect(run.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < run.length; i++) {
      expect(run[i]!.stack).toBeGreaterThan(run[i - 1]!.stack);
      expect(run[i]!.reach).toBeGreaterThan(run[i - 1]!.reach);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { deg, mm } from '../../domain/units.js';
import { evaluateSaddle } from '../saddle.js';

/**
 * Clamp to 70 mm width point. Stable at ~40 mm across saddle models - that is
 * why this reference is used at all.
 *
 * CONVENTION: setback here is measured to the WIDTH POINT, so realistic values
 * run 145-220 mm from the BB. The familiar nose-referenced figure of 50-95 mm
 * describes the same saddle 100 mm further forward. Mixing the two is the
 * easiest way to get a confidently wrong answer.
 */
const WIDTH_POINT = mm(40);

describe('saddle feasibility', () => {
  it('reaches an ordinary setback on an ordinary seat angle', () => {
    const r = evaluateSaddle(deg(73.5), { height: mm(742), setback: mm(175) }, WIDTH_POINT);
    expect(r.kind).toBe('reachable');
  });

  it('prefers the combination with the most rail margin left', () => {
    const r = evaluateSaddle(deg(73.5), { height: mm(742), setback: mm(175) }, WIDTH_POINT);
    if (r.kind !== 'reachable') throw new Error('expected reachable');
    expect(r.margin).toBeGreaterThan(0);
    expect(Math.abs(r.railOffset)).toBeLessThanOrEqual(r.post.railTravel);
  });

  it('fails when the seat angle cannot put the saddle far enough back', () => {
    // A very steep seat angle with a large setback demand is unreachable even
    // on a 25 mm setback post at the end of its rails.
    const r = evaluateSaddle(deg(78), { height: mm(700), setback: mm(300) }, WIDTH_POINT);
    expect(r.kind).toBe('unreachable');
    if (r.kind !== 'unreachable') throw new Error('expected unreachable');
    expect(r.shortfall).toBeGreaterThan(0);
  });

  it('keeps the two setback conventions apart', () => {
    // A nose-referenced 75 mm setback is NOT reachable as a width-point target:
    // it describes a saddle position 100 mm further forward than any road frame
    // puts it. The gate firing here is the model refusing a mixed convention.
    const mixed = evaluateSaddle(deg(73.5), { height: mm(742), setback: mm(75) }, WIDTH_POINT);
    expect(mixed.kind).toBe('unreachable');
  });

  it('a slacker seat angle carries the saddle back on its own', () => {
    // Compared on ONE fixed seatpost - rail offsets from different posts are not
    // comparable, since the post setback is part of the same sum.
    // 170 mm is inside rail travel for both angles on a zero-setback post.
    // At 180 mm the 75 degree frame already needs 28 mm of rail and fails - a
    // steep seat angle genuinely cannot reach a far-back saddle without a
    // setback post, which is the gate doing its job.
    const post = [{ setback: mm(0), railTravel: mm(25) }];
    const steep = evaluateSaddle(deg(75), { height: mm(742), setback: mm(170) }, WIDTH_POINT, post);
    const slack = evaluateSaddle(deg(72), { height: mm(742), setback: mm(170) }, WIDTH_POINT, post);
    if (steep.kind !== 'reachable' || slack.kind !== 'reachable') {
      throw new Error('both should be reachable on a zero-setback post');
    }
    // The slack frame already sits further back, so the rails must come FORWARD
    // to hit the same target; the steep frame needs them pushed back.
    expect(slack.railOffset).toBeGreaterThan(steep.railOffset);
    expect(steep.railOffset).toBeLessThan(0);
  });
});

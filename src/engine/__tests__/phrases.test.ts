import { describe, expect, it } from 'vitest';
import { bandOf, compare } from '../phrases';

describe('magnitude bands', () => {
  it('treats anything under 5 mm as no difference', () => {
    expect(bandOf(0)).toBe(0);
    expect(bandOf(4.9)).toBe(0);
    expect(bandOf(-4.9)).toBe(0);
  });
  it('steps at 5, 12, 25 and 40 mm', () => {
    expect(bandOf(5)).toBe(1);
    expect(bandOf(12)).toBe(2);
    expect(bandOf(25)).toBe(3);
    expect(bandOf(40)).toBe(4);
    expect(bandOf(-40)).toBe(4);
  });
});

describe('idioms fire only on the two named diagonals', () => {
  it('longer and lower is more aggressive', () => {
    expect(compare(18, -14).label).toBe('more aggressive');
  });
  it('shorter and taller is more relaxed', () => {
    expect(compare(-22, 19).label).toBe('more relaxed');
  });
  it('the other two quadrants stay compositional', () => {
    expect(compare(31, 28).label).toBe('noticeably longer and taller');
    expect(compare(-45, -42).label).toBe('much shorter and lower');
  });
  it('does not fire below the 12 mm band on both axes', () => {
    // 6 mm of reach with 14 mm of drop is not "more aggressive".
    expect(compare(6, -14).label).toBe('slightly longer and lower');
  });
});

describe('idioms carry magnitude', () => {
  // Without a qualifier, +16/-18 and +45/-40 would read identically - a lie a
  // rider would act on.
  it('separates a small diagonal from a large one', () => {
    expect(compare(16, -18).label).toBe('more aggressive');
    expect(compare(28, -26).label).toBe('noticeably more aggressive');
    expect(compare(45, -40).label).toBe('much more aggressive');
    expect(compare(16, -18).label).not.toBe(compare(45, -40).label);
  });
});

describe('shared qualifiers collapse', () => {
  it('says "much shorter and lower", never "much shorter and much lower"', () => {
    expect(compare(-45, -42).label).toBe('much shorter and lower');
  });
  it('keeps both qualifiers when the bands differ', () => {
    expect(compare(-7, -42).label).toBe('slightly shorter and much lower');
  });
});

describe('precise phrases always come from the numbers', () => {
  it('states both axes when both moved', () => {
    expect(compare(18, -14).precise).toBe('18 mm longer and 14 mm lower');
  });
  it('states one axis when only one moved', () => {
    expect(compare(9, 0).precise).toBe('9 mm shorter'.replace('shorter', 'longer'));
    expect(compare(0, 26).precise).toBe('26 mm taller');
  });
  it('never claims precision it does not have', () => {
    expect(compare(2, -3).label).toBe('essentially the same');
    expect(compare(2, -3).precise).toBe('within a few millimetres in both axes');
  });
  it('rounds to whole millimetres', () => {
    expect(compare(18.4, -13.6).precise).toBe('18 mm longer and 14 mm lower');
  });
});

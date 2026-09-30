import { describe, expect, it } from 'vitest';
import { normQ } from './query';
import { validQueries } from './testkit';
import { recommend, shapeOf, TYPE_IDS, unsuitable } from './visuals';

describe('recommend vs unsuitable', () => {
  const qs = validQueries();

  it('always gives three distinct suggestions', () => {
    qs.forEach((q) => {
      const r = recommend(q);
      expect(r).toHaveLength(3);
      expect(new Set(r).size).toBe(3);
    });
  });

  it('never recommends a type it would flag as "kurang pas"', () => {
    qs.forEach((q) => {
      recommend(q).forEach((t) => expect(unsuitable(t, q), `${t} for ${JSON.stringify(q)}`).toBe(''));
    });
  });

  it('leaves at least one suitable type for every query', () => {
    qs.forEach((q) => expect(TYPE_IDS.some((t) => unsuitable(t, q) === '')).toBe(true));
  });
});

describe('shape-driven choices', () => {
  it('suggests a gauge first for a single percentage', () => {
    expect(recommend(normQ({ measure: 'oee', agg: 'avg', group: 'none' }))[0]).toBe('gauge');
  });

  it('suggests a line for time series', () => {
    const q = normQ({ measure: 'reject', group: 'day' });
    expect(shapeOf(q)).toBe('time');
    expect(recommend(q)[0]).toBe('line');
  });

  it('flags portion charts for averages', () => {
    expect(unsuitable('pie', normQ({ measure: 'oee', agg: 'avg', group: 'lini' }))).toMatch(/porsi/);
  });

  it('asks for a split before a stacked bar', () => {
    expect(unsuitable('sbar', normQ({ measure: 'output', group: 'lini' }))).toMatch(/rincian/);
    expect(unsuitable('sbar', normQ({ measure: 'output', group: 'lini', split: 'shift' }))).toBe('');
  });
});

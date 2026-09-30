import { describe, expect, it } from 'vitest';
import { autoTitle, isAvailable, normQ, QUERY_SCHEMA_VERSION, sentenceOptions, splitsFor } from './query';
import { getCatalog, MEASURES, SOURCES } from './semantic';
import { rawCombos, validQueries } from './testkit';

describe('normQ — every sentence becomes a valid query', () => {
  const combos = rawCombos();

  it('covers the whole combination space', () => {
    expect(combos.length).toBe(7 * 5 * 7 * 3);
    expect(validQueries().length).toBeGreaterThan(80);
  });

  it.each(combos.map((c) => [`${c.measure}/${c.agg}/${c.group}/${c.split}`, c] as const))('%s', (_, raw) => {
    const q = normQ(raw);
    const m = MEASURES[q.measure];
    const src = SOURCES[m.src];
    expect(m.aggs).toContain(q.agg);
    expect(src.groups).toContain(q.group);
    expect(splitsFor(q)).toContain(q.split);
    if (q.split !== 'none') expect(q.split).not.toBe(q.group);
    if (m.pct) expect(q.agg).not.toBe('sum');
    expect(q.schemaVersion).toBe(QUERY_SCHEMA_VERSION);
    expect(normQ(q)).toEqual(q);
  });

  it('keeps a valid sentence untouched', () => {
    const q = normQ({ measure: 'output', agg: 'max', group: 'lini', split: 'shift', period: 'd7' });
    expect(q).toMatchObject({ measure: 'output', agg: 'max', group: 'lini', split: 'shift', period: 'd7', follow: true, filters: [], rule: null });
  });

  it('never offers a split on an overall number', () => {
    expect(splitsFor(normQ({ measure: 'output', group: 'none' }))).toEqual(['none']);
  });

  it('only keeps card filters on dimensions the source owns, with known values', () => {
    const q = normQ({
      measure: 'pallet', agg: 'sum', group: 'gudang',
      filters: [{ dim: 'lini', values: ['Lini 1'] }, { dim: 'gudang', values: ['GD-A', 'GD-X'] }],
    });
    expect(q.filters).toEqual([{ dim: 'gudang', values: ['GD-A'] }]);
  });

  it('drops a filter that selects every value (it means "all")', () => {
    const q = normQ({ measure: 'output', filters: [{ dim: 'shift', values: ['Shift 1', 'Shift 2', 'Shift 3'] }] });
    expect(q.filters).toEqual([]);
  });

  it('rejects malformed rules', () => {
    expect(normQ({ measure: 'oee', rule: { op: 'eq', value: 3 } }).rule).toBeNull();
    expect(normQ({ measure: 'oee', rule: { op: 'lt', value: 'x' } }).rule).toBeNull();
    expect(normQ({ measure: 'oee', rule: { op: 'gt', value: 3 } }).rule).toEqual({ op: 'gt', value: 3, tone: 'danger' });
  });

  it('keeps a removed measure so the card can say it is unavailable', () => {
    const q = normQ({ measure: 'energi', agg: 'sum', group: 'lini' });
    expect(q.measure).toBe('energi');
    expect(isAvailable(q)).toBe(false);
    expect(autoTitle(q)).toBe('Ukuran tidak tersedia');
  });
});

describe('titles and sentence options', () => {
  it('builds the automatic title from the sentence', () => {
    expect(autoTitle(normQ({ measure: 'output', agg: 'sum', group: 'lini', split: 'shift' }))).toBe('Total output produksi per lini, dirinci per shift');
    expect(autoTitle(normQ({ measure: 'oee', agg: 'avg', group: 'none' }))).toBe('Rata-rata OEE');
  });

  it('offers no "total" for percentages', () => {
    const opts = sentenceOptions(normQ({ measure: 'reject_rate' }));
    expect(opts.aggs.map((a) => a[0])).toEqual(['avg', 'max', 'min']);
  });
});

describe('GET /v1/catalog contract', () => {
  it('lists measures with their legal combinations', () => {
    const c = getCatalog();
    const output = c.measures.find((m) => m.id === 'output');
    expect(output).toEqual({
      id: 'output', label: 'Output produksi', source: 'MES Produksi',
      aggs: ['sum', 'avg', 'max', 'min', 'count'], groups: ['none', 'day', 'month', 'lini', 'shift'],
      splits: ['none', 'shift', 'lini'], filterable: ['lini', 'shift'],
    });
    expect(c.dimensions.find((d) => d.id === 'lini')).toMatchObject({ cardinality: 5, values: ['Lini 1', 'Lini 2', 'Lini 3', 'Lini 4', 'Lini 5'] });
  });
});

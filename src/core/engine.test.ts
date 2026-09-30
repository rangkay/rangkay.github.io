import { describe, expect, it } from 'vitest';
import { genData, monthLabels, ruleColor, ruleDefault, runQuery } from './engine';
import { normQ } from './query';
import { validQueries } from './testkit';
import type { DashboardFilters } from './types';

const AS_OF = new Date(2026, 8, 30, 8, 15);
const F: DashboardFilters = { period: 'd30', dims: [{ dim: 'lini', values: [] }] };

describe('POST /v1/query (sample engine)', () => {
  it('answers one entry per card with the contract fields', () => {
    const [r] = runQuery(
      { dashboardFilters: { period: 'd30', dims: [{ dim: 'lini', values: ['Lini 2'] }] }, cards: [{ id: 'c1', query: normQ({ measure: 'output', group: 'lini' }) }] },
      { asOf: AS_OF },
    );
    expect(r).toMatchObject({ id: 'c1', status: 'ok', effectiveFilters: { lini: ['Lini 2'] }, ignoredFilters: [], categories: ['Lini 2'] });
    expect(r.series[0].name).toBe('Output produksi');
    expect(r.asOf).toBe(AS_OF.toISOString());
  });

  it('reports ignored dashboard filters', () => {
    const [r] = runQuery({ dashboardFilters: { period: 'd30', dims: [{ dim: 'lini', values: ['Lini 2'] }] }, cards: [{ id: 'g', query: normQ({ measure: 'pallet', group: 'gudang' }) }] });
    expect(r.ignoredFilters).toEqual(['lini']);
    expect(r.categories).toEqual(['GD-A', 'GD-B', 'GD-C', 'GD-D']);
  });

  it('returns "empty" when the filters leave nothing', () => {
    const q = normQ({ measure: 'output', group: 'lini', filters: [{ dim: 'lini', values: ['Lini 1'] }] });
    const [r] = runQuery({ dashboardFilters: { period: 'd30', dims: [{ dim: 'lini', values: ['Lini 5'] }] }, cards: [{ id: 'e', query: q }] });
    expect(r.status).toBe('empty');
    expect(r.series).toEqual([]);
  });

  it('returns an error (422-equivalent) for a removed measure', () => {
    const [r] = runQuery({ dashboardFilters: F, cards: [{ id: 'x', query: normQ({ measure: 'energi' }) }] });
    expect(r.status).toBe('error');
    expect(r.error?.code).toBe('unknown_measure');
  });
});

describe('sample data follows the sentence', () => {
  it('is deterministic', () => {
    const q = normQ({ measure: 'output', group: 'lini', split: 'shift' });
    expect(genData(q, F, { asOf: AS_OF })).toEqual(genData(q, F, { asOf: AS_OF }));
  });

  it('produces finite numbers of the right shape for every valid query', () => {
    validQueries().forEach((q) => {
      const d = genData(q, F, { asOf: AS_OF });
      expect(Number.isFinite(d.single)).toBe(true);
      d.series.forEach((s) => {
        expect(s.values).toHaveLength(d.categories!.length);
        s.values.forEach((v) => expect(Number.isFinite(v)).toBe(true));
      });
      if (q.split !== 'none') expect(d.series.length).toBeGreaterThan(1);
    });
  });

  it('grows totals with the period and shrinks them with filters', () => {
    const q = normQ({ measure: 'output', agg: 'sum', group: 'none' });
    const month = genData(q, F).single!;
    const year = genData(q, { ...F, period: 'y' }).single!;
    const oneLine = genData(q, { period: 'd30', dims: [{ dim: 'lini', values: ['Lini 1'] }] }).single!;
    expect(year).toBeGreaterThan(month * 5);
    expect(oneLine).toBeLessThan(month / 3);
  });

  it('keeps percentages at or below 99.5', () => {
    const q = normQ({ measure: 'oee', agg: 'max', group: 'day' });
    genData(q, F).series[0].values.forEach((v) => expect(v).toBeLessThanOrEqual(99.5));
  });

  it('labels months ending at the as-of month', () => {
    expect(monthLabels('y', AS_OF)).toEqual(['Okt', 'Nov', 'Des', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep']);
    expect(monthLabels('q', AS_OF)).toEqual(['Jul', 'Agu', 'Sep']);
  });

  it('dims the rest of the board when another card is cross-highlighted', () => {
    const q = normQ({ measure: 'output', agg: 'sum', group: 'none' });
    const plain = genData(q, F).single!;
    const crossed = genData(q, F, { cross: { group: 'lini', value: 'Lini 2' } }).single!;
    expect(crossed).toBeLessThan(plain);
  });
});

describe('colour rules', () => {
  it('colours only values past the threshold', () => {
    expect(ruleColor(70, { op: 'lt', value: 75, tone: 'danger' })).toBe('#EF4444');
    expect(ruleColor(80, { op: 'lt', value: 75, tone: 'danger' })).toBeNull();
    expect(ruleColor(4, { op: 'gt', value: 3, tone: 'warn' })).toBe('#F59E0B');
    expect(ruleColor(4, null)).toBeNull();
  });

  it('defaults to the target for percentages', () => {
    expect(ruleDefault(normQ({ measure: 'oee', agg: 'avg' }), F)).toEqual({ op: 'lt', value: 85, tone: 'danger' });
    expect(ruleDefault(normQ({ measure: 'reject' }), F).op).toBe('gt');
  });
});

import { describe, expect, it } from 'vitest';
import { applyRowAccess, effState, subText, valsLabel } from './filters';
import { normQ } from './query';
import type { DashboardFilters } from './types';

const dash = (dims: DashboardFilters['dims'], period: DashboardFilters['period'] = 'd30'): DashboardFilters => ({ period, dims });

describe('the four merge rules', () => {
  it('rule 1: a dashboard dim the source does not own is ignored and reported', () => {
    const q = normQ({ measure: 'pallet', group: 'gudang' });
    const st = effState(q, dash([{ dim: 'lini', values: ['Lini 2'] }]));
    expect(st.ignored).toEqual(['lini']);
    expect(st.eff).toEqual({});
    expect(subText(q, dash([{ dim: 'lini', values: ['Lini 2'] }]))).toContain('filter lini tidak berlaku');
  });

  it('rule 2: dashboard and card filters on the same dim intersect', () => {
    const q = normQ({ measure: 'output', group: 'lini', filters: [{ dim: 'lini', values: ['Lini 2', 'Lini 3'] }] });
    expect(effState(q, dash([{ dim: 'lini', values: ['Lini 3', 'Lini 4'] }])).eff.lini).toEqual(['Lini 3']);
  });

  it('rule 2: an empty intersection is reported as empty, not as a blank chart', () => {
    const q = normQ({ measure: 'output', group: 'lini', filters: [{ dim: 'lini', values: ['Lini 1'] }] });
    expect(effState(q, dash([{ dim: 'lini', values: ['Lini 4'] }])).empty).toBe(true);
  });

  it('rule 3: with follow off only the card filters apply, and the period is the card\'s own', () => {
    const q = normQ({ measure: 'output', group: 'lini', follow: false, period: 'd7', filters: [{ dim: 'shift', values: ['Shift 1'] }] });
    const f = dash([{ dim: 'lini', values: ['Lini 4'] }], 'y');
    const st = effState(q, f);
    expect(st.eff).toEqual({ shift: ['Shift 1'] });
    expect(st.ignored).toEqual([]);
    const s = subText(q, f);
    expect(s.startsWith('7 hari terakhir')).toBe(true);
    expect(s).toContain('mengabaikan filter dashboard');
  });

  it('rule 4: row-level access only narrows and wins over user choices', () => {
    const q = normQ({ measure: 'output', group: 'lini' });
    const wide = effState(q, dash([{ dim: 'lini', values: [] }]));
    expect(applyRowAccess(wide, { lini: ['Lini 2'] }).eff.lini).toEqual(['Lini 2']);
    const forced = effState(q, dash([{ dim: 'lini', values: ['Lini 3'] }]));
    const r = applyRowAccess(forced, { lini: ['Lini 2'] });
    expect(r.eff.lini).toEqual([]);
    expect(r.empty).toBe(true);
  });
});

describe('labels', () => {
  it('describes all, some and many values', () => {
    expect(valsLabel('lini', [])).toBe('semua lini');
    expect(valsLabel('lini', ['Lini 2'])).toBe('Lini 2');
    expect(valsLabel('lini', ['Lini 2', 'Lini 3'])).toBe('Lini 2, Lini 3');
    expect(valsLabel('lini', ['Lini 1', 'Lini 2', 'Lini 3'])).toBe('3 lini');
  });

  it('writes the source and the applied filters in the subtitle', () => {
    const q = normQ({ measure: 'output', group: 'lini' });
    expect(subText(q, dash([{ dim: 'lini', values: ['Lini 2'] }]))).toBe('30 hari terakhir, dari MES Produksi, disaring ke Lini 2');
  });
});

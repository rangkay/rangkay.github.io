import { describe, expect, it } from 'vitest';
import { applyUrlFilters, filtersToParams, hasFilterParams } from './urlFilters';
import type { DashboardFilters } from './types';

const DEF: DashboardFilters = { period: 'd30', dims: [{ dim: 'lini', values: [] }, { dim: 'shift', values: ['Shift 1'] }] };

describe('reader filters in the URL', () => {
  it('round-trips a reader choice', () => {
    const chosen: DashboardFilters = { period: 'd7', dims: [{ dim: 'lini', values: ['Lini 2', 'Lini 3'] }, { dim: 'shift', values: [] }] };
    const params = filtersToParams(chosen, DEF);
    expect(params.toString()).toBe('periode=d7&lini=Lini+2&lini=Lini+3&shift=*');
    expect(applyUrlFilters(DEF, params)).toEqual(chosen);
  });

  it('writes nothing when the view equals the defaults', () => {
    expect(filtersToParams(DEF, DEF).toString()).toBe('');
    expect(hasFilterParams(new URLSearchParams(''), DEF)).toBe(false);
  });

  it('cannot add a filter the dashboard does not have', () => {
    const r = applyUrlFilters(DEF, new URLSearchParams('gudang=GD-A'));
    expect(r.dims.map((d) => d.dim)).toEqual(['lini', 'shift']);
  });

  it('drops unknown values and periods', () => {
    const r = applyUrlFilters(DEF, new URLSearchParams('periode=z&lini=Lini+9&lini=Lini+1'));
    expect(r.period).toBe('d30');
    expect(r.dims[0].values).toEqual(['Lini 1']);
  });
});

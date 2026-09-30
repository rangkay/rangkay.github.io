/**
 * Reader filter choices live in the URL, so a shared link carries the same view.
 * A URL can only choose values for filters the dashboard already has, and only
 * values the semantic model knows: it can never add a filter or widen access.
 */
import { DIMS, PERIOD_DAYS } from './semantic';
import type { DashPeriod, DashboardFilters } from './types';

export const PERIOD_PARAM = 'periode';

export function hasFilterParams(params: URLSearchParams, filters: DashboardFilters): boolean {
  return params.has(PERIOD_PARAM) || filters.dims.some((f) => params.has(f.dim));
}

export function applyUrlFilters(filters: DashboardFilters, params: URLSearchParams): DashboardFilters {
  const p = params.get(PERIOD_PARAM) as DashPeriod | null;
  return {
    period: p && p in PERIOD_DAYS ? p : filters.period,
    dims: filters.dims.map((f) => {
      if (!params.has(f.dim)) return { dim: f.dim, values: [...f.values] };
      const asked = params.getAll(f.dim);
      const vals = DIMS[f.dim].values.filter((v) => asked.includes(v));
      return { dim: f.dim, values: vals.length === DIMS[f.dim].values.length ? [] : vals };
    }),
  };
}

/** Params that describe `filters` relative to the dashboard defaults (only differences are written). */
export function filtersToParams(filters: DashboardFilters, defaults: DashboardFilters): URLSearchParams {
  const out = new URLSearchParams();
  if (filters.period !== defaults.period) out.set(PERIOD_PARAM, filters.period);
  filters.dims.forEach((f) => {
    const d = defaults.dims.find((x) => x.dim === f.dim);
    const same = d && d.values.length === f.values.length && d.values.every((v) => f.values.includes(v));
    if (same) return;
    if (!f.values.length) out.append(f.dim, '*');
    else f.values.forEach((v) => out.append(f.dim, v));
  });
  return out;
}

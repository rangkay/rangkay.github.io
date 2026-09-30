/**
 * The four merge rules between dashboard and visual filters:
 *  1. dashboard dims the card's source does not own are ignored (and said so in the subtitle);
 *  2. a following card with its own filter on the same dim gets the intersection;
 *  3. with "follow" off only the card's own filters apply (period is always the card's sentence);
 *  4. row-level access is applied last and can only narrow (see `applyRowAccess`).
 */
import { cap } from './format';
import { DIMS, MEASURES, PERIODS, SOURCES } from './semantic';
import type { DashPeriod, DashboardFilters, DimFilter, Query } from './types';

export interface EffectiveState {
  /** dimension → values actually applied (only dims the source owns) */
  eff: Record<string, string[]>;
  /** dashboard dims that do not apply to this card's source */
  ignored: string[];
  /** true when an intersection leaves nothing */
  empty: boolean;
}

export function effPeriod(q: Query, filters: DashboardFilters): DashPeriod {
  return q.period === 'dash' ? filters.period : q.period;
}

export function valsLabel(dim: string, vals: string[]): string {
  const d = DIMS[dim];
  if (!vals.length) return 'semua ' + d.lower;
  if (vals.length === 1) return vals[0];
  if (vals.length === 2) return vals.join(', ');
  return vals.length + ' ' + d.lower;
}

function toMap(list: DimFilter[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  list.forEach((f) => {
    if (f.values && f.values.length) out[f.dim] = f.values;
  });
  return out;
}

export function effState(q: Query, filters: DashboardFilters): EffectiveState {
  const m = MEASURES[q.measure];
  const dims = m ? SOURCES[m.src].dims : [];
  const follow = q.follow !== false;
  const dash = toMap(filters.dims || []);
  const card = toMap(q.filters || []);
  const eff: Record<string, string[]> = {};
  const ignored: string[] = [];
  let empty = false;

  Object.keys(dash).forEach((d) => {
    if (follow && !dims.includes(d)) ignored.push(d);
  });
  dims.forEach((d) => {
    const dv = follow ? dash[d] : undefined;
    const cv = card[d];
    const v = dv && cv ? cv.filter((x) => dv.includes(x)) : dv || cv || null;
    if (v) {
      eff[d] = DIMS[d].values.filter((x) => v.includes(x));
      if (!eff[d].length) empty = true;
    }
  });
  return { eff, ignored, empty };
}

/** Rule 4: row-level access always wins. Values outside the grant are removed. */
export function applyRowAccess(state: EffectiveState, grants: Record<string, string[]>): EffectiveState {
  const eff = { ...state.eff };
  let empty = state.empty;
  Object.entries(grants).forEach(([dim, allowed]) => {
    if (!(dim in DIMS)) return;
    const base = eff[dim] ?? DIMS[dim].values;
    eff[dim] = base.filter((v) => allowed.includes(v));
    if (!eff[dim].length) empty = true;
  });
  return { ...state, eff, empty };
}

/** The card subtitle, which always tells the reader what the number covers. */
export function subText(q: Query, filters: DashboardFilters): string {
  const m = MEASURES[q.measure];
  if (!m) return 'Ukuran ini sudah dihapus dari sumber data';
  const st = effState(q, filters);
  const parts = Object.keys(st.eff).map((d) => valsLabel(d, st.eff[d]));
  let s = cap(PERIODS[effPeriod(q, filters)]) + ', dari ' + m.src;
  if (parts.length) s += ', disaring ke ' + parts.join('; ');
  if (st.ignored.length) s += ', filter ' + st.ignored.map((d) => DIMS[d].lower).join(' dan ') + ' tidak berlaku';
  if (q.follow === false && (filters.dims || []).some((f) => f.values && f.values.length)) s += ', mengabaikan filter dashboard';
  return s;
}

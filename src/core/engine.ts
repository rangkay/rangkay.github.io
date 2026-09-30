/**
 * Sample-data query engine. It answers the same request/response contract as
 * POST /v1/query, so moving to live data swaps the transport, not the UI.
 * Numbers are deterministic and follow the sentence (sums grow with the period,
 * filters shrink totals, percentages stay bounded).
 */
import { BULAN, DIMS, GROUPS, MEASURES, PERIOD_DAYS, SOURCES } from './semantic';
import { effPeriod, effState } from './filters';
import { hash, rnd } from './format';
import type { CrossHighlight, DashPeriod, DashboardFilters, Query, Rule, RuleTone } from './types';

export interface Series {
  name: string;
  values: number[];
}

export interface ResultData {
  categories: string[] | null;
  series: Series[];
  /** overall number (total for sums, mean otherwise) */
  single: number | null;
  /** short trend for KPI sparklines */
  spark: number[];
  /** change against the previous period, % (or points for percentages) */
  delta: number;
}

export type QueryStatus = 'ok' | 'empty' | 'error';

export interface CardResult extends ResultData {
  id: string;
  status: QueryStatus;
  error?: { code: string; message: string };
  cacheLayer: 'sample';
  asOf: string;
  effectiveFilters: Record<string, string[]>;
  ignoredFilters: string[];
}

export interface QueryRequest {
  dashboardFilters: DashboardFilters;
  cards: { id: string; query: Query }[];
}

export interface EngineContext {
  /** the moment data is "as of"; defaults to now */
  asOf?: Date;
  cross?: CrossHighlight | null;
}

export const RULE_COLORS: Record<RuleTone, string> = { danger: '#EF4444', warn: '#F59E0B', success: '#10B981' };

const DAY = 86400000;

export function dayLabels(n: number, end: Date): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end.getTime() - i * DAY);
    out.push(d.getDate() + ' ' + BULAN[d.getMonth()]);
  }
  return out;
}

export function monthLabels(per: DashPeriod, end: Date): string[] {
  const n = per === 'y' ? 12 : per === 'q' ? 3 : 2;
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(BULAN[(end.getMonth() - i + 12 * 2) % 12]);
  return out;
}

const EMPTY: ResultData = { categories: null, series: [], single: null, spark: [], delta: 0 };

/** Generate the sample result for one query. Returns an empty result for unknown measures. */
export function genData(q: Query, filters: DashboardFilters, ctx: EngineContext = {}): ResultData {
  const m = MEASURES[q.measure];
  const g = GROUPS[q.group];
  if (!m || !g) return EMPTY;
  const end = ctx.asOf ?? new Date();
  const per = effPeriod(q, filters);
  const days = PERIOD_DAYS[per];
  const eff = effState(q, filters).eff;
  const cross = ctx.cross && ctx.cross.group !== q.group ? ctx.cross.value : '';
  const seed = hash([q.measure, q.agg, q.group, q.split, per, JSON.stringify(eff), cross].join('|'));
  const crossF = cross ? 0.45 : 1;
  const hasLini = SOURCES[m.src].dims.includes('lini');
  const nL = hasLini ? (eff.lini || DIMS.lini.values).length : 1;
  const linMul = q.group !== 'lini' && q.split !== 'lini' ? nL : 1;
  let oFrac = 1;
  Object.keys(eff).forEach((d) => {
    if (d === 'lini' || d === q.group || d === q.split) return;
    oFrac *= eff[d].length / DIMS[d].values.length;
  });
  const mul = linMul * oFrac;
  const aggK = q.agg === 'max' ? (m.pct ? 1.1 : 1.45) : q.agg === 'min' ? (m.pct ? 0.82 : 0.55) : 1;
  const dec = (m.pct || m.dec) && q.agg !== 'count';
  const fin = (v: number) => {
    if (m.pct && q.agg !== 'count') v = Math.min(v, 99.5);
    return dec ? Math.round(v * 10) / 10 : Math.round(v);
  };
  const out: ResultData = { categories: null, series: [], single: null, spark: [], delta: Math.round((rnd(seed, 88) - 0.42) * (m.pct ? 40 : 140)) / 10 };

  if (g.kind === 'none') {
    const r = rnd(seed, 77);
    let v: number;
    if (q.agg === 'count') v = days * 24 * (0.8 + r * 0.4) * mul * crossF;
    else if (m.pct) v = m.base * (0.9 + r * 0.2) * aggK;
    else if (q.agg === 'sum') v = m.base * days * mul * (0.92 + r * 0.16) * crossF;
    else v = m.base * (0.85 + r * 0.3) * aggK;
    const single = fin(v);
    out.single = single;
    for (let k = 0; k < 12; k++) out.spark.push(fin(single * (0.86 + rnd(seed, k + 200) * 0.28)));
    return out;
  }

  const cats =
    g.kind === 'time'
      ? q.group === 'day' ? dayLabels(Math.min(days, 30), end) : monthLabels(per, end)
      : (eff[q.group] || g.cats || []).slice();
  const splits = q.split === 'none' ? null : (eff[q.split] || DIMS[q.split].values).slice();

  const cell = (i: number, j: number): number => {
    const r = rnd(seed, i * 17 + j * 101 + 3);
    if (q.agg === 'count') {
      const v = (6 + r * 18) * (g.kind === 'time' ? (q.group === 'month' ? 30 : 1) : days / 7) * mul * crossF;
      return Math.max(1, Math.round(v));
    }
    if (m.pct) return fin(m.base * (0.8 + r * 0.4) * aggK);
    let v = m.base * (0.6 + r * 0.8) * aggK;
    if (q.agg === 'sum') {
      if (g.kind === 'time') {
        if (q.group === 'month') v *= 30;
      } else v *= days;
      v *= mul;
      if (g.kind === 'cat' && q.group !== 'lini') v /= Math.max(1, (g.cats || []).length / 2);
      if (splits) v = (v / splits.length) * 1.3;
      v *= crossF;
    }
    return fin(v);
  };

  out.categories = cats;
  out.series = splits
    ? splits.map((sn, j) => ({ name: sn, values: cats.map((_, i) => cell(i, j + 1)) }))
    : [{ name: m.label, values: cats.map((_, i) => cell(i, 0)) }];
  const flat = out.series.flatMap((s) => s.values);
  const sum = flat.reduce((a, b) => a + b, 0);
  out.single = fin(q.agg === 'sum' || q.agg === 'count' ? sum : sum / flat.length);
  const s0 = out.series[0].values;
  out.spark = s0.length >= 4 ? s0.slice(-12) : s0.concat(s0, s0);
  return out;
}

/** POST /v1/query, answered locally from sample data. */
export function runQuery(req: QueryRequest, ctx: EngineContext = {}): CardResult[] {
  const asOf = (ctx.asOf ?? new Date()).toISOString();
  return req.cards.map(({ id, query }) => {
    const st = effState(query, req.dashboardFilters);
    const common = { id, cacheLayer: 'sample' as const, asOf, effectiveFilters: st.eff, ignoredFilters: st.ignored };
    if (!MEASURES[query.measure]) {
      return {
        ...common, ...EMPTY, status: 'error' as const,
        error: { code: 'unknown_measure', message: 'Ukuran ini sudah dihapus dari sumber data. Ganti ukurannya lewat Ubah visual.' },
      };
    }
    if (st.empty) return { ...common, ...EMPTY, status: 'empty' as const };
    return { ...common, ...genData(query, req.dashboardFilters, ctx), status: 'ok' as const };
  });
}

export function ruleColor(v: number | null, rule: Rule | null): string | null {
  if (!rule || v == null) return null;
  if ((rule.op === 'lt' && v < rule.value) || (rule.op === 'gt' && v > rule.value)) return RULE_COLORS[rule.tone] || RULE_COLORS.danger;
  return null;
}

/** A sensible starting rule: target for percentages, otherwise 10% worse than today. */
export function ruleDefault(q: Query, filters: DashboardFilters, ctx: EngineContext = {}): Rule {
  const m = MEASURES[q.measure];
  const pct = !!m?.pct && q.agg !== 'count';
  const d = genData(q, filters, ctx);
  const value = m?.target && pct ? m.target : Math.round((d.single || 0) * (m?.good === 'up' ? 0.9 : 1.1) * 10) / 10;
  return { op: m?.good === 'up' ? 'lt' : 'gt', value, tone: 'danger' };
}

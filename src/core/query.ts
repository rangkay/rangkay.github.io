/**
 * Query validation shared by client and server. `normQ` turns any stored or half-edited
 * sentence into the nearest valid one, so the composer never shows an invalid combination.
 */
import { cap } from './format';
import { AGGS, DIMS, GROUPS, MEASURES, PERIODS, SOURCES, SPLITS, isKnownMeasure } from './semantic';
import type { Agg, CardPeriod, DimFilter, Query, Rule } from './types';

export const QUERY_SCHEMA_VERSION = 2;

const RULE_OPS = ['lt', 'gt'];
const RULE_TONES = ['danger', 'warn', 'success'];

export type QueryInput = Partial<Omit<Query, 'filters' | 'rule'>> & {
  filters?: unknown;
  rule?: unknown;
};

function normRule(r: unknown): Rule | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  const value = Number(o.value);
  if (!RULE_OPS.includes(String(o.op)) || !Number.isFinite(value)) return null;
  return { op: o.op as Rule['op'], value, tone: (RULE_TONES.includes(String(o.tone)) ? o.tone : 'danger') as Rule['tone'] };
}

function rawFilters(f: unknown): DimFilter[] {
  if (!Array.isArray(f)) return [];
  return f
    .filter((x): x is { dim: unknown; values?: unknown } => !!x && typeof x === 'object')
    .map((x) => ({ dim: String(x.dim), values: Array.isArray(x.values) ? x.values.map(String) : [] }));
}

/** Splits allowed for a query: the source's splits, never the same as the grouping. */
export function splitsFor(q: Pick<Query, 'measure' | 'group'>): string[] {
  const m = MEASURES[q.measure];
  if (!m || !GROUPS[q.group] || GROUPS[q.group].kind === 'none') return ['none'];
  return SOURCES[m.src].splits.filter((s) => s !== q.group);
}

/** Only keep filters on dimensions the source owns, with known values; "all" or "none" is dropped. */
export function normCardFilters(measure: string, filters: DimFilter[]): DimFilter[] {
  const m = MEASURES[measure];
  const dimsOk = m ? SOURCES[m.src].dims : [];
  const seen = new Set<string>();
  return filters
    .filter((f) => dimsOk.includes(f.dim) && !seen.has(f.dim) && seen.add(f.dim))
    .map((f) => ({ dim: f.dim, values: DIMS[f.dim].values.filter((v) => f.values.includes(v)) }))
    .filter((f) => f.values.length > 0 && f.values.length < DIMS[f.dim].values.length);
}

export function normQ(input: QueryInput): Query {
  const version = Number(input.schemaVersion) || QUERY_SCHEMA_VERSION;
  const base: Query = {
    schemaVersion: Math.max(version, QUERY_SCHEMA_VERSION),
    measure: String(input.measure ?? 'output'),
    agg: (input.agg ?? 'sum') as Agg,
    group: String(input.group ?? 'none'),
    split: String(input.split ?? 'none'),
    period: (PERIODS[input.period as CardPeriod] ? input.period : 'dash') as CardPeriod,
    filters: rawFilters(input.filters),
    follow: input.follow !== false,
    rule: normRule(input.rule),
  };
  // A measure removed by the admin is kept as-is so the card can say "ukuran tidak tersedia".
  if (!isKnownMeasure(base.measure)) return base;

  const m = MEASURES[base.measure];
  const src = SOURCES[m.src];
  if (!m.aggs.includes(base.agg)) base.agg = m.def;
  if (!src.groups.includes(base.group)) base.group = src.groups.includes('lini') ? 'lini' : src.groups[src.groups.length - 1];
  if (!splitsFor(base).includes(base.split)) base.split = 'none';
  base.filters = normCardFilters(base.measure, base.filters);
  return base;
}

export function isAvailable(q: Query): boolean {
  return isKnownMeasure(q.measure);
}

export function autoTitle(q: Query): string {
  const m = MEASURES[q.measure];
  if (!m) return 'Ukuran tidak tersedia';
  let t = AGGS[q.agg] + ' ' + m.lower;
  if (q.group !== 'none') t += ' ' + GROUPS[q.group].label;
  if (q.split !== 'none') t += ', ' + SPLITS[q.split];
  return cap(t);
}

export function sameQ(a: Query, b: Query): boolean {
  return a.measure === b.measure && a.agg === b.agg && a.group === b.group && (a.split || 'none') === (b.split || 'none');
}

/** Options for each pill in the sentence, straight from the semantic model. */
export function sentenceOptions(q: Query) {
  const m = MEASURES[q.measure];
  return {
    aggs: m ? m.aggs.map((a) => [a, AGGS[a].toLowerCase()] as [string, string]) : [],
    groups: m ? SOURCES[m.src].groups.map((g) => [g, GROUPS[g].label] as [string, string]) : [],
    splits: splitsFor(q).map((s) => [s, SPLITS[s]] as [string, string]),
    periods: (Object.keys(PERIODS) as CardPeriod[]).map((p) => [p, PERIODS[p]] as [string, string]),
    dims: m ? SOURCES[m.src].dims : [],
  };
}

/** A card's visible title: the automatic one unless the editor wrote their own. */
export function cardTitle(c: { auto: boolean; title: string; q: Query }): string {
  return c.auto || !c.title ? autoTitle(c.q) : c.title;
}

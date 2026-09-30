/** Helpers for tests: every sentence the composer could ever form. Not imported by the app. */
import { normQ } from './query';
import { AGGS, GROUPS, MEASURES, SPLITS } from './semantic';
import type { Agg, Query } from './types';

/** All raw (unnormalised) combinations of measure × agg × group × split. */
export function rawCombos(): Partial<Query>[] {
  const out: Partial<Query>[] = [];
  Object.keys(MEASURES).forEach((measure) =>
    (Object.keys(AGGS) as Agg[]).forEach((agg) =>
      Object.keys(GROUPS).forEach((group) =>
        Object.keys(SPLITS).forEach((split) => out.push({ measure, agg, group, split, period: 'dash' })),
      ),
    ),
  );
  return out;
}

/** Distinct valid queries reachable from any raw combination. */
export function validQueries(): Query[] {
  const seen = new Map<string, Query>();
  rawCombos().forEach((r) => {
    const q = normQ(r);
    seen.set([q.measure, q.agg, q.group, q.split].join('|'), q);
  });
  return [...seen.values()];
}

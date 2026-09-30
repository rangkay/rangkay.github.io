/** Shapes shared by the client and (later) the Composer API. Queries are data, never SQL. */

export type Agg = 'sum' | 'avg' | 'max' | 'min' | 'count';
export type GroupKind = 'none' | 'time' | 'cat';
export type CardPeriod = 'dash' | 'd7' | 'd30' | 'q' | 'y';
export type DashPeriod = Exclude<CardPeriod, 'dash'>;
export type RuleOp = 'lt' | 'gt';
export type RuleTone = 'danger' | 'warn' | 'success';
export type Tone = 'blue' | 'red' | 'green' | 'violet' | 'amber';
export type IconName =
  | 'box' | 'alert' | 'gauge' | 'layers' | 'clock' | 'sparkle';

export type VisualType =
  | 'kpi' | 'bignum' | 'gauge' | 'bullet'
  | 'bar' | 'hbar' | 'sbar' | 'combo' | 'waterfall'
  | 'line' | 'area'
  | 'pie' | 'rose' | 'treemap' | 'funnel'
  | 'scatter' | 'bubble' | 'radar' | 'heat' | 'boxplot'
  | 'table';

export interface Rule {
  op: RuleOp;
  value: number;
  tone: RuleTone;
}

/** One filter on one dimension. An empty `values` list means "all values". */
export interface DimFilter {
  dim: string;
  values: string[];
}

/** The composer sentence, as data (schema version 2). */
export interface Query {
  schemaVersion: number;
  measure: string;
  agg: Agg;
  group: string;
  split: string;
  period: CardPeriod;
  filters: DimFilter[];
  follow: boolean;
  rule: Rule | null;
}

export interface DashboardFilters {
  period: DashPeriod;
  dims: DimFilter[];
}

export interface Card {
  id: string;
  page: string;
  q: Query;
  type: VisualType;
  /** true when the title follows the sentence automatically */
  auto: boolean;
  title: string;
  /** width in grid columns (1–12) */
  span: number;
  /** height in px */
  h: number;
}

export interface Page {
  id: string;
  name: string;
}

export interface Board {
  id: string;
  name: string;
  tag: string;
  filters: DashboardFilters;
  pages: Page[];
  page: string;
  cards: Card[];
  updatedAt: number;
}

export interface SourceStatus {
  name: string;
  detail: string;
  sync: string;
  status: 'ok' | 'warn' | 'err';
}

/** Cross-highlight: clicking a bar or slice dims the rest. It is never a stored filter. */
export interface CrossHighlight {
  group: string;
  value: string;
}

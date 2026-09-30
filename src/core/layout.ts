/**
 * One sizing rule for both View and Edit: a card's width in columns is clamped to a minimum
 * pixel width, so what the reader sees is exactly what the editor designed.
 */
import { clamp } from './format';
import { SINGLE } from './visuals';
import type { Card, VisualType } from './types';

export const COLS = 12;
export const GAP = 14;
export const MIN_PX = 180;
export const MIN_H = 140;
export const MAX_H = 760;
/** Below this viewport width every visual takes the full row. */
export const FULL_WIDTH_BELOW = 700;
/** Dashboards with more visuals than this per page get a new page automatically. */
export const MAX_CARDS_PER_PAGE = 20;

export function defaultSize(t: VisualType): [number, number] {
  if (t === 'kpi') return [3, 176];
  if (t === 'bignum') return [3, 196];
  if (t === 'gauge') return [4, 270];
  if (t === 'bullet') return [6, 230];
  if (t === 'table') return [12, 310];
  if (t === 'line' || t === 'area' || t === 'combo' || t === 'sbar' || t === 'heat' || t === 'waterfall') return [8, 310];
  return [6, 310];
}

/** After a type change keep the height sensible for the new type. */
export function fitHeight(type: VisualType, h: number): number {
  if (SINGLE[type] && h > 260) return 196;
  if (!SINGLE[type] && h < 230) return 300;
  return h;
}

/** Smallest span that still gives MIN_PX at the given grid width. */
export function minSpan(gridWidth: number): number {
  if (!gridWidth) return 2;
  const colW = (gridWidth + GAP) / COLS;
  return clamp(Math.ceil((MIN_PX + GAP) / colW), 2, COLS);
}

export function effSpan(span: number, gridWidth: number, viewportWidth: number): number {
  if (viewportWidth < FULL_WIDTH_BELOW) return COLS;
  return clamp(span, minSpan(gridWidth), COLS);
}

export function sizeLabel(c: Pick<Card, 'span' | 'h'>, min: number): string {
  return (c.span === COLS ? 'Lebar penuh' : c.span + ' dari 12 kolom') + ', tinggi ' + c.h + ' px' + (c.span === min ? ' (terkecil)' : '');
}

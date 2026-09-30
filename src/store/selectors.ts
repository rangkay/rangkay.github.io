import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { applyUrlFilters, hasFilterParams } from '../core/urlFilters';
import type { Board, DashboardFilters } from '../core/types';
import { useStore } from './store';

export { cardTitle } from '../core/query';

export function useCurrentBoard(): Board | null {
  return useStore((s) => s.boards.find((b) => b.id === s.boardId) ?? null);
}

export function useCanEdit(): boolean {
  return useStore((s) => s.role === 'editor' && !(s.boardId && s.readOnly.includes(s.boardId)));
}

const NO_FILTERS: DashboardFilters = { period: 'd30', dims: [] };

/**
 * The filters the board is shown with: the dashboard defaults, overridden by the reader's
 * choices in the URL (which can only pick values, never add filters).
 */
export function useActiveFilters(): { filters: DashboardFilters; fromUrl: boolean } {
  const board = useCurrentBoard();
  const [params] = useSearchParams();
  const defaults = board?.filters ?? NO_FILTERS;
  return useMemo(() => {
    if (!hasFilterParams(params, defaults)) return { filters: defaults, fromUrl: false };
    return { filters: applyUrlFilters(defaults, params), fromUrl: true };
  }, [defaults, params]);
}

/**
 * Autosave. In the demo the dashboards live in this browser's localStorage; in the product the
 * same calls become small PATCH requests to Directus with a revision number. When storage is
 * blocked (private window) the state is kept for the session and the top bar says so.
 */
import { loadStored, STORE_VERSION, type LoadedState } from '../core/migrate';
import type { Board, SourceStatus } from '../core/types';

export const STORAGE_KEY = 'rangkai.v2';

let memory: string | null = null;

export function loadState(): LoadedState | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = memory;
  }
  if (!raw) return null;
  try {
    return loadStored(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Returns false when the data could only be kept in memory. */
export function saveState(boards: Board[], sources: SourceStatus[]): boolean {
  const raw = JSON.stringify({ v: STORE_VERSION, boards, sources });
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
    return true;
  } catch {
    memory = raw;
    return false;
  }
}

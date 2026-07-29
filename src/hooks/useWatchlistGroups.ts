import { useCallback, useEffect, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage";
import type { WatchlistItem } from "../types";

export interface WatchlistGroup {
  id: string;
  name: string;
  keys: string[];
}

const STORAGE_KEY = "5ix-watchlist-groups";
const LEGACY_FLAT_KEY = "5ix-watchlist";

interface GroupsState {
  groups: WatchlistGroup[];
  activeGroupId: string;
}

function makeId(): string {
  return `wl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function defaultState(): GroupsState {
  // Seed from the pre-tabs single watchlist, if one exists, so nobody loses their list.
  const legacy = loadJSON<WatchlistItem[]>(LEGACY_FLAT_KEY, []);
  const id = makeId();
  return {
    groups: [{ id, name: "Watchlist", keys: legacy.map((item) => item.key) }],
    activeGroupId: id,
  };
}

export function useWatchlistGroups() {
  const [state, setState] = useState<GroupsState>(() => loadJSON<GroupsState>(STORAGE_KEY, defaultState()));

  useEffect(() => {
    saveJSON(STORAGE_KEY, state);
  }, [state]);

  const activeGroup = state.groups.find((g) => g.id === state.activeGroupId) ?? state.groups[0];

  const selectGroup = useCallback((id: string) => {
    setState((prev) => (prev.groups.some((g) => g.id === id) ? { ...prev, activeGroupId: id } : prev));
  }, []);

  const addGroup = useCallback((name: string) => {
    const id = makeId();
    setState((prev) => ({ groups: [...prev.groups, { id, name, keys: [] }], activeGroupId: id }));
  }, []);

  const removeGroup = useCallback((id: string) => {
    setState((prev) => {
      if (prev.groups.length <= 1) return prev;
      const groups = prev.groups.filter((g) => g.id !== id);
      const activeGroupId = prev.activeGroupId === id ? groups[0].id : prev.activeGroupId;
      return { groups, activeGroupId };
    });
  }, []);

  const addKeyToActiveGroup = useCallback((key: string) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === prev.activeGroupId && !g.keys.includes(key) ? { ...g, keys: [...g.keys, key] } : g)),
    }));
  }, []);

  /** Removes a key from the active group's view; returns true if no group references it anymore. */
  const removeKeyFromActiveGroup = useCallback((key: string): boolean => {
    let orphaned = false;
    setState((prev) => {
      const groups = prev.groups.map((g) => (g.id === prev.activeGroupId ? { ...g, keys: g.keys.filter((k) => k !== key) } : g));
      orphaned = !groups.some((g) => g.keys.includes(key));
      return { ...prev, groups };
    });
    return orphaned;
  }, []);

  return {
    groups: state.groups,
    activeGroup,
    selectGroup,
    addGroup,
    removeGroup,
    addKeyToActiveGroup,
    removeKeyFromActiveGroup,
  };
}

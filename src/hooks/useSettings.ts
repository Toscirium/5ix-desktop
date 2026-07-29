import { useCallback, useEffect, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage";
import { DEFAULT_SETTINGS, SETTINGS_KEY } from "../lib/settings";
import type { Settings } from "../types";

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => loadJSON<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS));

  useEffect(() => {
    saveJSON(SETTINGS_KEY, settings);
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  return { settings, updateSettings };
}

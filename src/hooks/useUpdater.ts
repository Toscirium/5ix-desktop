import { useCallback, useState } from "react";

export type UpdateState = "idle" | "checking" | "up-to-date" | "available" | "downloading" | "ready" | "error";

export function useUpdater() {
  const [state, setState] = useState<UpdateState>("idle");
  const [version, setVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkForUpdates = useCallback(async () => {
    setState("checking");
    setError(null);
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      if (!update) {
        setState("up-to-date");
        return;
      }
      setVersion(update.version);
      setState("available");

      await update.downloadAndInstall();
      setState("ready");
    } catch (e) {
      setError(String(e));
      setState("error");
    }
  }, []);

  const relaunch = useCallback(async () => {
    const { relaunch: doRelaunch } = await import("@tauri-apps/plugin-process");
    await doRelaunch();
  }, []);

  return { state, version, error, checkForUpdates, relaunch };
}

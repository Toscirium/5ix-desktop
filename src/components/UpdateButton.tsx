import { useUpdater } from "../hooks/useUpdater";

export function UpdateButton() {
  const { state, version, error, checkForUpdates, relaunch } = useUpdater();

  if (state === "ready") {
    return (
      <button className="btn btn-primary update-btn" onClick={relaunch}>
        Restart to Update {version ? `(v${version})` : ""}
      </button>
    );
  }

  const label =
    state === "checking"
      ? "Checking…"
      : state === "downloading" || state === "available"
        ? `Downloading v${version}…`
        : state === "up-to-date"
          ? "Up to date"
          : state === "error"
            ? "Update check failed"
            : "Check for Updates";

  return (
    <button
      className="btn-icon update-btn"
      onClick={checkForUpdates}
      disabled={state === "checking" || state === "downloading" || state === "available"}
      title={error ?? "Check for updates"}
    >
      {label}
    </button>
  );
}

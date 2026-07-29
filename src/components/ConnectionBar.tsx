import { useEffect, useState } from "react";
import type { Theme } from "../hooks/useTheme";
import { loadJSON, saveJSON } from "../lib/storage";
import { KeyboardShortcutsDialog } from "./KeyboardShortcutsDialog";
import { SettingsDialog } from "./SettingsDialog";
import { UpdateButton } from "./UpdateButton";
import type { ConnectionStatus, Settings } from "../types";

const STORAGE_KEY = "5ix-connection-settings";

interface StoredSettings {
  host: string;
  port: number;
  clientId: number;
}

const DEFAULT_SETTINGS: StoredSettings = { host: "127.0.0.1", port: 4002, clientId: 100 };

interface ConnectionBarProps {
  connection: ConnectionStatus;
  connecting: boolean;
  selectedAccount: string | null;
  theme: Theme;
  settings: Settings;
  onConnect: (host: string, port: number, clientId: number) => void;
  onDisconnect: () => void;
  onSelectAccount: (account: string) => void;
  onToggleTheme: () => void;
  onChangeSettings: (patch: Partial<Settings>) => void;
}

export function ConnectionBar({
  connection,
  connecting,
  selectedAccount,
  theme,
  settings,
  onConnect,
  onDisconnect,
  onSelectAccount,
  onToggleTheme,
  onChangeSettings,
}: ConnectionBarProps) {
  const [host, setHost] = useState(() => loadJSON(STORAGE_KEY, DEFAULT_SETTINGS).host);
  const [port, setPort] = useState(() => loadJSON(STORAGE_KEY, DEFAULT_SETTINGS).port);
  const [clientId, setClientId] = useState(() => loadJSON(STORAGE_KEY, DEFAULT_SETTINGS).clientId);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    saveJSON(STORAGE_KEY, { host, port, clientId });
  }, [host, port, clientId]);

  return (
    <header className="connection-bar">
      <div className="brand">
        <span className="brand-dot" />
        <span className="brand-word">
          <span className="brand-accent">5</span>ix
        </span>
      </div>
      <div className="connection-fields">
        <input
          value={host}
          onChange={(e) => setHost(e.target.value)}
          disabled={connection.connected}
          placeholder="Host"
          className="conn-input conn-input-host"
        />
        <input
          type="number"
          value={port}
          onChange={(e) => setPort(Number(e.target.value))}
          disabled={connection.connected}
          placeholder="Port"
          className="conn-input conn-input-port"
        />
        <input
          type="number"
          value={clientId}
          onChange={(e) => setClientId(Number(e.target.value))}
          disabled={connection.connected}
          placeholder="Client ID"
          className="conn-input conn-input-client"
        />
        {connection.connected ? (
          <button className="btn btn-danger" onClick={onDisconnect}>
            Disconnect
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => onConnect(host, port, clientId)} disabled={connecting}>
            {connecting ? "Connecting…" : "Connect"}
          </button>
        )}
      </div>
      {connection.connected && (connection.accounts?.length ?? 0) > 0 && (
        <select
          className="conn-input account-select"
          value={selectedAccount ?? ""}
          onChange={(e) => onSelectAccount(e.target.value)}
        >
          {connection.accounts!.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      )}
      <div className="status-indicator">
        <span className={connection.connected ? "status-dot status-dot-live" : "status-dot"} />
        {connection.connected ? `Connected (server v${connection.serverVersion ?? "?"})` : "Disconnected"}
      </div>
      <UpdateButton />
      <button
        className="theme-toggle"
        onClick={onToggleTheme}
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        aria-label="Toggle color theme"
      >
        {theme === "dark" ? "☀" : "☾"}
      </button>
      <button
        className="theme-toggle"
        onClick={() => setShowShortcuts(true)}
        title="Keyboard shortcuts"
        aria-label="Show keyboard shortcuts"
      >
        ?
      </button>
      <button className="theme-toggle" onClick={() => setShowSettings(true)} title="Settings" aria-label="Open settings">
        ⚙
      </button>
      {showShortcuts && <KeyboardShortcutsDialog onClose={() => setShowShortcuts(false)} />}
      {showSettings && (
        <SettingsDialog settings={settings} onChange={onChangeSettings} onClose={() => setShowSettings(false)} />
      )}
    </header>
  );
}

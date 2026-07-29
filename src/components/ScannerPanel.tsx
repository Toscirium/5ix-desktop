import { useState } from "react";
import { SCAN_CODES } from "../types";
import type { ContractSpec, ScannerRow } from "../types";

interface ScannerPanelProps {
  connected: boolean;
  onRun: (scanCode: string, instrument: string, locationCode: string, numberOfRows: number) => Promise<ScannerRow[]>;
  onAddToWatchlist: (spec: ContractSpec) => void;
}

export function ScannerPanel({ connected, onRun, onAddToWatchlist }: ScannerPanelProps) {
  const [scanCode, setScanCode] = useState(SCAN_CODES[0].value);
  const [instrument, setInstrument] = useState("STK");
  const [locationCode, setLocationCode] = useState("STK.US.MAJOR");
  const [rows, setRows] = useState<ScannerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await onRun(scanCode, instrument, locationCode, 25);
      setRows(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel scanner-panel">
      <div className="panel-header">
        <span>Scanner</span>
      </div>
      <div className="watchlist-add">
        <select value={scanCode} onChange={(e) => setScanCode(e.target.value)} disabled={!connected}>
          {SCAN_CODES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div className="watchlist-add watchlist-add-sub">
        <input value={instrument} onChange={(e) => setInstrument(e.target.value)} placeholder="Instrument (STK)" disabled={!connected} />
        <input value={locationCode} onChange={(e) => setLocationCode(e.target.value)} placeholder="Location (STK.US.MAJOR)" disabled={!connected} />
      </div>
      <div className="watchlist-add-submit">
        <button className="btn btn-secondary" onClick={run} disabled={!connected || loading}>
          {loading ? "Scanning…" : "Run Scan"}
        </button>
      </div>
      {error && <div className="error-banner">{error}</div>}
      <table className="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Symbol</th>
            <th>Name</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="empty-row">
                {connected ? "Run a scan to see results" : "Connect to run a scan"}
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={`${r.rank}-${r.symbol}`}>
              <td>{r.rank + 1}</td>
              <td className="symbol-cell">{r.symbol}</td>
              <td className="text-muted">{r.longName}</td>
              <td>
                <button
                  className="btn-icon"
                  onClick={() => onAddToWatchlist({ assetType: "STOCK", symbol: r.symbol })}
                  title="Add to watchlist"
                >
                  +
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

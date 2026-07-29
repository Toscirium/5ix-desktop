import { useState } from "react";
import { downloadCsv, toCsv } from "../lib/csv";
import type { Execution } from "../types";

interface TradeBlotterPanelProps {
  connected: boolean;
  fetchExecutions: (days: number) => Promise<Execution[]>;
}

const DAY_RANGES = [
  { label: "1D", value: 1 },
  { label: "7D", value: 7 },
  { label: "30D", value: 30 },
];

function fmt(n: number, digits = 2) {
  return n.toFixed(digits);
}

export function TradeBlotterPanel({ connected, fetchExecutions }: TradeBlotterPanelProps) {
  const [days, setDays] = useState(7);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async (range: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchExecutions(range);
      setExecutions(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const selectRange = (range: number) => {
    setDays(range);
    if (connected) refresh(range);
  };

  const exportCsv = () => {
    const csv = toCsv(
      ["Time", "Symbol", "Side", "Shares", "Price", "Commission", "Exchange"],
      executions.map((e) => [e.time, e.symbol, e.side, e.shares, e.price, e.commission ?? "", e.exchange]),
    );
    downloadCsv(csv, `trade-blotter-${days}d-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="panel trade-blotter-panel">
      <div className="panel-header">
        <span>Trade Blotter</span>
        <div className="bar-size-picker">
          {DAY_RANGES.map((r) => (
            <button
              key={r.value}
              className={r.value === days ? "chip chip-active" : "chip"}
              onClick={() => selectRange(r.value)}
            >
              {r.label}
            </button>
          ))}
          <button className="btn-icon" onClick={() => refresh(days)} disabled={!connected || loading} title="Refresh">
            ⟳
          </button>
          <button className="btn-icon" onClick={exportCsv} disabled={executions.length === 0} title="Export CSV">
            ⇩
          </button>
        </div>
      </div>
      {error && <div className="error-banner">{error}</div>}
      <table className="data-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Symbol</th>
            <th>Side</th>
            <th>Shares</th>
            <th>Price</th>
            <th>Commission</th>
            <th>Exch</th>
          </tr>
        </thead>
        <tbody>
          {executions.length === 0 && (
            <tr>
              <td colSpan={7} className="empty-row">
                {connected ? (loading ? "Loading…" : "No executions in range") : "Connect to view trade history"}
              </td>
            </tr>
          )}
          {executions.map((e, i) => (
            <tr key={`${e.orderId}-${i}`}>
              <td className="text-muted">{e.time}</td>
              <td className="symbol-cell">{e.symbol}</td>
              <td className={e.side.toUpperCase().includes("SLD") || e.side.toUpperCase() === "SELL" ? "text-down" : "text-up"}>
                {e.side}
              </td>
              <td>{fmt(e.shares, 0)}</td>
              <td>{fmt(e.price)}</td>
              <td>{e.commission != null ? fmt(e.commission) : "—"}</td>
              <td>{e.exchange}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

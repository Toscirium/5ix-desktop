import type { Position } from "../types";

interface PositionsPanelProps {
  positions: Position[];
  connected: boolean;
  selectedAccount: string | null;
  onRefresh: () => void;
}

function displaySymbol(p: Position) {
  if (p.securityType === "Option" && p.localSymbol) return p.localSymbol;
  if (p.securityType === "Option") {
    return `${p.symbol} ${p.expiry ?? ""} ${p.strike ?? ""}${p.right === "PUT" ? "P" : "C"}`;
  }
  return p.localSymbol || p.symbol;
}

export function PositionsPanel({ positions, connected, selectedAccount, onRefresh }: PositionsPanelProps) {
  const accountCount = new Set(positions.map((p) => p.account)).size;
  const visible = accountCount > 1 && selectedAccount ? positions.filter((p) => p.account === selectedAccount) : positions;

  return (
    <div className="panel positions-panel">
      <div className="panel-header">
        <span>Positions</span>
        <button className="btn-icon" onClick={onRefresh} disabled={!connected} title="Refresh">
          ⟳
        </button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Type</th>
            <th>Qty</th>
            <th>Avg Cost</th>
            <th>Exch</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr>
              <td colSpan={5} className="empty-row">
                {connected ? "No open positions" : "Connect to view positions"}
              </td>
            </tr>
          )}
          {visible.map((p, i) => (
            <tr key={`${p.account}-${p.symbol}-${p.localSymbol}-${i}`}>
              <td className="symbol-cell">{displaySymbol(p)}</td>
              <td className="text-muted">{p.securityType}</td>
              <td className={p.position >= 0 ? "text-up" : "text-down"}>{p.position}</td>
              <td>{p.averageCost.toFixed(2)}</td>
              <td>{p.exchange}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

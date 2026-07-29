import type { DepthBook } from "../types";

interface MarketDepthPanelProps {
  connected: boolean;
  symbolLabel: string | null;
  depthBook: DepthBook | null;
}

function fmt(n: number, digits = 2) {
  return n.toFixed(digits);
}

export function MarketDepthPanel({ connected, symbolLabel, depthBook }: MarketDepthPanelProps) {
  const rows = depthBook ? Math.max(depthBook.bids.length, depthBook.asks.length) : 0;
  const maxSize = depthBook
    ? Math.max(1, ...depthBook.bids.map((b) => b?.size ?? 0), ...depthBook.asks.map((a) => a?.size ?? 0))
    : 1;

  return (
    <div className="panel market-depth-panel">
      <div className="panel-header">
        <span>Market Depth{symbolLabel ? ` — ${symbolLabel}` : ""}</span>
      </div>
      <table className="data-table depth-table">
        <thead>
          <tr>
            <th>Size</th>
            <th>Bid</th>
            <th>Ask</th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>
          {rows === 0 && (
            <tr>
              <td colSpan={4} className="empty-row">
                {!connected ? "Connect to view market depth" : !symbolLabel ? "Select a symbol to view depth" : "Waiting for depth data…"}
              </td>
            </tr>
          )}
          {Array.from({ length: rows }).map((_, i) => {
            const bid = depthBook?.bids[i] ?? null;
            const ask = depthBook?.asks[i] ?? null;
            return (
              <tr key={i}>
                <td className="depth-size-cell">
                  {bid && <div className="depth-bar depth-bar-bid" style={{ width: `${(bid.size / maxSize) * 100}%` }} />}
                  <span>{bid ? fmt(bid.size, 0) : ""}</span>
                </td>
                <td className="text-up depth-price-cell">{bid ? fmt(bid.price) : ""}</td>
                <td className="text-down depth-price-cell">{ask ? fmt(ask.price) : ""}</td>
                <td className="depth-size-cell depth-size-cell-ask">
                  {ask && <div className="depth-bar depth-bar-ask" style={{ width: `${(ask.size / maxSize) * 100}%` }} />}
                  <span>{ask ? fmt(ask.size, 0) : ""}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

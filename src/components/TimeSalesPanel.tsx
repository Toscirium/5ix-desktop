import type { TradeTick } from "../types";

interface TimeSalesPanelProps {
  connected: boolean;
  symbolLabel: string | null;
  tape: TradeTick[];
}

function fmtTime(epochSeconds: number) {
  return new Date(epochSeconds * 1000).toLocaleTimeString(undefined, { hour12: false });
}

function fmt(n: number, digits = 2) {
  return n.toFixed(digits);
}

export function TimeSalesPanel({ connected, symbolLabel, tape }: TimeSalesPanelProps) {
  return (
    <div className="panel time-sales-panel">
      <div className="panel-header">
        <span>Time &amp; Sales{symbolLabel ? ` — ${symbolLabel}` : ""}</span>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Price</th>
            <th>Size</th>
            <th>Exch</th>
          </tr>
        </thead>
        <tbody>
          {tape.length === 0 && (
            <tr>
              <td colSpan={4} className="empty-row">
                {!connected ? "Connect to view time & sales" : !symbolLabel ? "Select a symbol to view the tape" : "Waiting for trades…"}
              </td>
            </tr>
          )}
          {tape.map((t, i) => (
            <tr key={`${t.time}-${i}`} title={t.specialConditions || undefined}>
              <td className="text-muted">{fmtTime(t.time)}</td>
              <td className={t.pastLimit ? "text-down" : ""}>{fmt(t.price)}</td>
              <td>{fmt(t.size, 0)}</td>
              <td>{t.exchange}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

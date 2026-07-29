import { useState } from "react";
import type { AlertCondition, PriceAlert, WatchlistItem } from "../types";

interface PriceAlertsPanelProps {
  alerts: PriceAlert[];
  watchlist: WatchlistItem[];
  onAdd: (key: string, label: string, condition: AlertCondition, price: number) => void;
  onRemove: (id: string) => void;
}

export function PriceAlertsPanel({ alerts, watchlist, onAdd, onRemove }: PriceAlertsPanelProps) {
  const [selectedKey, setSelectedKey] = useState("");
  const [condition, setCondition] = useState<AlertCondition>("ABOVE");
  const [price, setPrice] = useState<number | "">("");

  const submit = () => {
    const item = watchlist.find((w) => w.key === selectedKey);
    if (!item || price === "" || Number(price) <= 0) return;
    onAdd(item.key, item.label, condition, Number(price));
    setPrice("");
  };

  return (
    <div className="panel price-alerts-panel">
      <div className="panel-header">
        <span>Price Alerts</span>
      </div>
      <div className="watchlist-add">
        <select value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)}>
          <option value="">Symbol…</option>
          {watchlist.map((w) => (
            <option key={w.key} value={w.key}>
              {w.label}
            </option>
          ))}
        </select>
        <select value={condition} onChange={(e) => setCondition(e.target.value as AlertCondition)}>
          <option value="ABOVE">Above</option>
          <option value="BELOW">Below</option>
        </select>
        <input
          type="number"
          step="0.01"
          value={price}
          placeholder="Price"
          onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
        />
      </div>
      <div className="watchlist-add-submit">
        <button className="btn btn-secondary" onClick={submit} disabled={!selectedKey || price === ""}>
          Add Alert
        </button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Condition</th>
            <th>Price</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {alerts.length === 0 && (
            <tr>
              <td colSpan={4} className="empty-row">
                No alerts set
              </td>
            </tr>
          )}
          {alerts.map((a) => (
            <tr key={a.id} className={a.triggered ? "alert-triggered" : ""}>
              <td className="symbol-cell">{a.label}</td>
              <td>{a.condition === "ABOVE" ? "Above" : "Below"}</td>
              <td>{a.price}</td>
              <td>
                <button className="btn-icon" onClick={() => onRemove(a.id)} title="Remove">
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

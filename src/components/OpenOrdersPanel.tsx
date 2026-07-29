import { useState } from "react";
import { orderTypeFromIbkr } from "../types";
import type { OpenOrder, OrderSide, OrderType } from "../types";

interface OpenOrdersPanelProps {
  openOrders: OpenOrder[];
  connected: boolean;
  onRefresh: () => void;
  onCancel: (orderId: number) => Promise<void>;
  onModify: (
    orderId: number,
    side: OrderSide,
    quantity: number,
    orderType: OrderType,
    limitPrice?: number,
    auxPrice?: number,
    trailingPercent?: number,
  ) => Promise<void>;
}

function ModifyRow({ order, onModify, onDone }: { order: OpenOrder; onModify: OpenOrdersPanelProps["onModify"]; onDone: () => void }) {
  const orderType = orderTypeFromIbkr(order.orderType);
  const [quantity, setQuantity] = useState(order.totalQuantity);
  const [limitPrice, setLimitPrice] = useState(order.limitPrice ?? 0);
  const [auxPrice, setAuxPrice] = useState(order.auxPrice ?? 0);
  const [busy, setBusy] = useState(false);

  const needsLimit = orderType === "LIMIT" || orderType === "STOP_LIMIT";
  const needsAux = orderType === "STOP" || orderType === "STOP_LIMIT" || orderType === "TRAILING_STOP";

  const submit = async () => {
    setBusy(true);
    try {
      await onModify(
        order.orderId,
        order.action.toUpperCase() === "SELL" ? "SELL" : "BUY",
        quantity,
        orderType,
        needsLimit ? limitPrice : undefined,
        needsAux ? auxPrice : undefined,
        undefined,
      );
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="modify-row">
      <td colSpan={7}>
        <div className="modify-form">
          <label>
            Qty
            <input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          </label>
          {needsAux && (
            <label>
              Stop
              <input type="number" step="0.01" value={auxPrice} onChange={(e) => setAuxPrice(Number(e.target.value))} />
            </label>
          )}
          {needsLimit && (
            <label>
              Limit
              <input type="number" step="0.01" value={limitPrice} onChange={(e) => setLimitPrice(Number(e.target.value))} />
            </label>
          )}
          <button className="btn btn-secondary" onClick={submit} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
          <button className="btn-icon" onClick={onDone}>
            Cancel edit
          </button>
        </div>
      </td>
    </tr>
  );
}

export function OpenOrdersPanel({ openOrders, connected, onRefresh, onCancel, onModify }: OpenOrdersPanelProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const cancel = async (orderId: number) => {
    setCancellingId(orderId);
    try {
      await onCancel(orderId);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="panel open-orders-panel">
      <div className="panel-header">
        <span>Open Orders</span>
        <button className="btn-icon" onClick={onRefresh} disabled={!connected} title="Refresh">
          ⟳
        </button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Symbol</th>
            <th>Side</th>
            <th>Type</th>
            <th>Qty</th>
            <th>Price</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {openOrders.length === 0 && (
            <tr>
              <td colSpan={7} className="empty-row">
                {connected ? "No open orders" : "Connect to view open orders"}
              </td>
            </tr>
          )}
          {openOrders.map((o) =>
            editingId === o.orderId ? (
              <ModifyRow key={o.orderId} order={o} onModify={onModify} onDone={() => setEditingId(null)} />
            ) : (
              <tr key={o.orderId}>
                <td>{o.orderId}</td>
                <td className="symbol-cell">{o.symbol}</td>
                <td className={o.action.toUpperCase() === "SELL" ? "text-down" : "text-up"}>{o.action}</td>
                <td>{o.orderType}</td>
                <td>{o.totalQuantity}</td>
                <td>{o.limitPrice ?? o.auxPrice ?? "—"}</td>
                <td className="row-actions">
                  <button className="btn-icon" onClick={() => setEditingId(o.orderId)} title="Modify">
                    ✎
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => cancel(o.orderId)}
                    disabled={cancellingId === o.orderId}
                    title="Cancel"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

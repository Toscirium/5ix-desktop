import { createPortal } from "react-dom";
import { useEscapeToClose } from "../hooks/useEscapeToClose";
import type { AlgoOptions, OrderSide, OrderType } from "../types";

interface PendingOrder {
  label: string;
  side: OrderSide;
  quantity: number;
  orderType: OrderType;
  limitPrice?: number;
  auxPrice?: number;
  trailingPercent?: number;
  algo?: AlgoOptions;
  bracket?: { takeProfit: number; stopLoss: number };
  estimatedNotional: number | null;
  warning: string | null;
}

interface OrderConfirmDialogProps {
  order: PendingOrder;
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  MARKET: "Market",
  LIMIT: "Limit",
  STOP: "Stop",
  STOP_LIMIT: "Stop-Limit",
  TRAILING_STOP: "Trailing Stop",
};

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function OrderConfirmDialog({ order, submitting, onConfirm, onCancel }: OrderConfirmDialogProps) {
  useEscapeToClose(onCancel);
  const { label, side, quantity, orderType, limitPrice, auxPrice, trailingPercent, algo, bracket, estimatedNotional, warning } = order;

  return createPortal(
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          Confirm {side === "BUY" ? "Buy" : "Sell"} {bracket ? "Bracket " : ""}Order
        </div>
        <div className="modal-body">
          <div className="modal-row">
            <span>Symbol</span>
            <span className="symbol-cell">{label}</span>
          </div>
          <div className="modal-row">
            <span>Side</span>
            <span className={side === "BUY" ? "text-up" : "text-down"}>{side}</span>
          </div>
          <div className="modal-row">
            <span>Quantity</span>
            <span>{quantity.toLocaleString()}</span>
          </div>
          <div className="modal-row">
            <span>Order Type</span>
            <span>{ORDER_TYPE_LABELS[orderType]}</span>
          </div>
          {auxPrice != null && (
            <div className="modal-row">
              <span>{orderType === "TRAILING_STOP" ? "Initial Stop" : "Stop Price"}</span>
              <span>{auxPrice}</span>
            </div>
          )}
          {limitPrice != null && (
            <div className="modal-row">
              <span>Limit Price</span>
              <span>{limitPrice}</span>
            </div>
          )}
          {trailingPercent != null && (
            <div className="modal-row">
              <span>Trailing Percent</span>
              <span>{trailingPercent}%</span>
            </div>
          )}
          {algo && (
            <div className="modal-row">
              <span>Algo</span>
              <span>
                {algo.strategy}
                {algo.maxPctVol != null ? ` (max ${Math.round(algo.maxPctVol * 100)}%)` : ""}
              </span>
            </div>
          )}
          {bracket && (
            <>
              <div className="modal-row">
                <span>Take Profit</span>
                <span className="text-up">{bracket.takeProfit}</span>
              </div>
              <div className="modal-row">
                <span>Stop Loss</span>
                <span className="text-down">{bracket.stopLoss}</span>
              </div>
            </>
          )}
          {estimatedNotional != null && (
            <div className="modal-row">
              <span>Est. Value</span>
              <span>{formatMoney(estimatedNotional)}</span>
            </div>
          )}
        </div>
        {warning && <div className="modal-warning">{warning}</div>}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button className={side === "BUY" ? "btn btn-buy" : "btn btn-sell"} onClick={onConfirm} disabled={submitting}>
            {submitting ? "Submitting…" : `Confirm ${side === "BUY" ? "Buy" : "Sell"}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

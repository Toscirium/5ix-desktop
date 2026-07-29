import { useEffect, useState } from "react";
import { OrderConfirmDialog } from "./OrderConfirmDialog";
import type { AlgoOptions, AlgoStrategy, BracketOrderIds, ContractSpec, OrderSide, OrderType, OrderUpdate, Quote, Settings } from "../types";

interface OrderTicketProps {
  label: string | null;
  spec: ContractSpec | null;
  quote?: Quote;
  connected: boolean;
  settings: Settings;
  onSubmit: (
    spec: ContractSpec,
    side: OrderSide,
    quantity: number,
    orderType: OrderType,
    limitPrice?: number,
    auxPrice?: number,
    trailingPercent?: number,
    algo?: AlgoOptions,
  ) => Promise<number>;
  onSubmitBracket: (
    spec: ContractSpec,
    side: OrderSide,
    quantity: number,
    entryPrice: number | undefined,
    takeProfit: number,
    stopLoss: number,
  ) => Promise<BracketOrderIds>;
  orderLog: OrderUpdate[];
}

const ORDER_TYPES: { value: OrderType; label: string }[] = [
  { value: "MARKET", label: "Market" },
  { value: "LIMIT", label: "Limit" },
  { value: "STOP", label: "Stop" },
  { value: "STOP_LIMIT", label: "Stop-Limit" },
  { value: "TRAILING_STOP", label: "Trailing Stop" },
];

const ALGO_STRATEGIES: { value: "NONE" | AlgoStrategy; label: string }[] = [
  { value: "NONE", label: "None" },
  { value: "VWAP", label: "VWAP" },
  { value: "TWAP", label: "TWAP" },
];

// Simple heuristics to flag an order worth a second look before it's sent.
function buildWarning(quantity: number, notional: number | null, settings: Settings): string | null {
  const reasons: string[] = [];
  if (notional != null && notional > settings.largeNotionalThreshold) {
    reasons.push(`estimated value of ${notional.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`);
  }
  if (quantity > settings.largeQuantityThreshold) {
    reasons.push(`a quantity of ${quantity.toLocaleString()}`);
  }
  if (reasons.length === 0) return null;
  return `This order has ${reasons.join(" and ")}. Double-check before confirming.`;
}

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

export function OrderTicket({ label, spec, quote, connected, settings, onSubmit, onSubmitBracket, orderLog }: OrderTicketProps) {
  const [side, setSide] = useState<OrderSide>("BUY");
  const [quantity, setQuantity] = useState(settings.defaultQuantity);
  const [orderType, setOrderType] = useState<OrderType>("MARKET");
  const [limitPrice, setLimitPrice] = useState<number | "">("");
  const [stopPrice, setStopPrice] = useState<number | "">("");
  const [trailingPercent, setTrailingPercent] = useState<number | "">("");
  const [algoStrategy, setAlgoStrategy] = useState<"NONE" | AlgoStrategy>("NONE");
  const [algoStartTime, setAlgoStartTime] = useState("");
  const [algoEndTime, setAlgoEndTime] = useState("");
  const [algoMaxPctVol, setAlgoMaxPctVol] = useState<number | "">("");
  const [bracketEnabled, setBracketEnabled] = useState(false);
  const [takeProfitPrice, setTakeProfitPrice] = useState<number | "">("");
  const [stopLossPrice, setStopLossPrice] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingOrder | null>(null);

  useEffect(() => {
    setLastResult(null);
  }, [label]);

  const needsLimit = orderType === "LIMIT" || orderType === "STOP_LIMIT";
  const needsStop = orderType === "STOP" || orderType === "STOP_LIMIT" || orderType === "TRAILING_STOP";
  const needsTrailingPercent = orderType === "TRAILING_STOP";
  const supportsAlgo = orderType === "MARKET" || orderType === "LIMIT";
  const supportsBracket = orderType === "MARKET" || orderType === "LIMIT";

  useEffect(() => {
    if (!supportsAlgo) setAlgoStrategy("NONE");
  }, [supportsAlgo]);

  useEffect(() => {
    if (!supportsBracket) setBracketEnabled(false);
  }, [supportsBracket]);

  const doSubmit = async () => {
    if (!spec || !pending) return;
    setSubmitting(true);
    setLastResult(null);
    try {
      if (pending.bracket) {
        const ids = await onSubmitBracket(
          spec,
          pending.side,
          pending.quantity,
          pending.limitPrice,
          pending.bracket.takeProfit,
          pending.bracket.stopLoss,
        );
        setLastResult(`Submitted bracket #${ids.parentId} (TP #${ids.takeProfitId}, SL #${ids.stopLossId})`);
      } else {
        const orderId = await onSubmit(
          spec,
          pending.side,
          pending.quantity,
          pending.orderType,
          pending.limitPrice,
          pending.auxPrice,
          pending.trailingPercent,
          pending.algo,
        );
        setLastResult(`Submitted order #${orderId}`);
      }
      setPending(null);
    } catch (e) {
      setLastResult(`Failed: ${String(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openConfirm = () => {
    if (!spec || !label) return;
    const limit = needsLimit ? Number(limitPrice) : undefined;
    const aux = needsStop ? Number(stopPrice) : undefined;
    const trailing = needsTrailingPercent ? Number(trailingPercent) : undefined;
    const algo: AlgoOptions | undefined =
      algoStrategy === "NONE"
        ? undefined
        : {
            strategy: algoStrategy,
            startTime: algoStartTime.trim() || undefined,
            endTime: algoEndTime.trim() || undefined,
            maxPctVol: algoStrategy === "VWAP" && algoMaxPctVol !== "" ? Number(algoMaxPctVol) : undefined,
          };
    const bracket = bracketEnabled ? { takeProfit: Number(takeProfitPrice), stopLoss: Number(stopLossPrice) } : undefined;
    const referencePrice = limit ?? quote?.last ?? quote?.ask ?? quote?.bid ?? null;
    const estimatedNotional = referencePrice != null ? referencePrice * quantity : null;
    setPending({
      label,
      side,
      quantity,
      orderType,
      limitPrice: limit,
      auxPrice: aux,
      trailingPercent: trailing,
      algo,
      bracket,
      estimatedNotional,
      warning: buildWarning(quantity, estimatedNotional, settings),
    });
  };

  const fieldsValid =
    quantity > 0 &&
    (!needsLimit || Number(limitPrice) > 0) &&
    (!needsStop || Number(stopPrice) > 0) &&
    (!needsTrailingPercent || Number(trailingPercent) > 0) &&
    (!bracketEnabled || (Number(takeProfitPrice) > 0 && Number(stopLossPrice) > 0));

  const canSubmit = connected && !!spec && fieldsValid && !submitting;

  return (
    <div className="panel order-ticket-panel">
      <div className="panel-header">
        <span>Order Ticket {label ? `— ${label}` : ""}</span>
      </div>
      {!spec && <div className="empty-state">Select an instrument to trade</div>}
      {spec && (
        <div className="order-form">
          <div className="side-toggle">
            <button className={side === "BUY" ? "chip chip-buy chip-active" : "chip chip-buy"} onClick={() => setSide("BUY")}>
              Buy
            </button>
            <button className={side === "SELL" ? "chip chip-sell chip-active" : "chip chip-sell"} onClick={() => setSide("SELL")}>
              Sell
            </button>
          </div>
          <label className="field">
            <span>Quantity</span>
            <input type="number" value={quantity} min={1} onChange={(e) => setQuantity(Number(e.target.value))} />
          </label>
          <label className="field">
            <span>Order Type</span>
            <select value={orderType} onChange={(e) => setOrderType(e.target.value as OrderType)}>
              {ORDER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          {needsStop && (
            <label className="field">
              <span>{orderType === "TRAILING_STOP" ? "Initial Stop Price" : "Stop Price"}</span>
              <input
                type="number"
                value={stopPrice}
                step="0.01"
                onChange={(e) => setStopPrice(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </label>
          )}
          {needsLimit && (
            <label className="field">
              <span>Limit Price</span>
              <input
                type="number"
                value={limitPrice}
                step="0.01"
                onChange={(e) => setLimitPrice(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </label>
          )}
          {needsTrailingPercent && (
            <label className="field">
              <span>Trailing Percent</span>
              <input
                type="number"
                value={trailingPercent}
                step="0.1"
                onChange={(e) => setTrailingPercent(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </label>
          )}
          {supportsBracket && (
            <label className="field settings-checkbox-row">
              <span>Attach bracket (take-profit / stop-loss)</span>
              <input
                type="checkbox"
                checked={bracketEnabled}
                disabled={algoStrategy !== "NONE"}
                onChange={(e) => setBracketEnabled(e.target.checked)}
              />
            </label>
          )}
          {bracketEnabled && (
            <>
              <label className="field">
                <span>Take Profit Price</span>
                <input
                  type="number"
                  value={takeProfitPrice}
                  step="0.01"
                  onChange={(e) => setTakeProfitPrice(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </label>
              <label className="field">
                <span>Stop Loss Price</span>
                <input
                  type="number"
                  value={stopLossPrice}
                  step="0.01"
                  onChange={(e) => setStopLossPrice(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </label>
            </>
          )}
          {supportsAlgo && (
            <label className="field">
              <span>Algo Strategy</span>
              <select
                value={algoStrategy}
                disabled={bracketEnabled}
                onChange={(e) => setAlgoStrategy(e.target.value as "NONE" | AlgoStrategy)}
              >
                {ALGO_STRATEGIES.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {supportsAlgo && algoStrategy !== "NONE" && (
            <>
              <label className="field">
                <span>Start Time (e.g. 09:30:00 US/Eastern)</span>
                <input value={algoStartTime} onChange={(e) => setAlgoStartTime(e.target.value)} placeholder="Optional" />
              </label>
              <label className="field">
                <span>End Time</span>
                <input value={algoEndTime} onChange={(e) => setAlgoEndTime(e.target.value)} placeholder="Optional" />
              </label>
              {algoStrategy === "VWAP" && (
                <label className="field">
                  <span>Max Participation Rate (0.1–0.5)</span>
                  <input
                    type="number"
                    step="0.05"
                    min={0.1}
                    max={0.5}
                    value={algoMaxPctVol}
                    onChange={(e) => setAlgoMaxPctVol(e.target.value === "" ? "" : Number(e.target.value))}
                    placeholder="Optional"
                  />
                </label>
              )}
            </>
          )}
          <button className={side === "BUY" ? "btn btn-buy" : "btn btn-sell"} onClick={openConfirm} disabled={!canSubmit}>
            {`${side === "BUY" ? "Buy" : "Sell"} ${label}`}
          </button>
          {lastResult && <div className="order-result">{lastResult}</div>}
        </div>
      )}
      <div className="order-log">
        <div className="order-log-header">Recent Activity</div>
        <div className="order-log-list">
          {orderLog.length === 0 && <div className="empty-row">No order activity yet</div>}
          {orderLog.map((u, i) => (
            <div key={i} className="order-log-row">
              {u.kind === "status" && (
                <span>
                  #{u.orderId} {u.status} {u.filled}/{(u.filled ?? 0) + (u.remaining ?? 0)}
                </span>
              )}
              {u.kind === "execution" && (
                <span>
                  Fill: {u.side} {u.shares} {u.symbol} @ {u.price}
                </span>
              )}
              {u.kind === "commission" && <span>Commission: {u.commission?.toFixed(2)}</span>}
            </div>
          ))}
        </div>
      </div>
      {pending && (
        <OrderConfirmDialog order={pending} submitting={submitting} onConfirm={doSubmit} onCancel={() => setPending(null)} />
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useEscapeToClose } from "../hooks/useEscapeToClose";
import type { ContractSpec, OptionChainInfo, OptionSnapshot } from "../types";

interface OptionsChainDialogProps {
  symbol: string;
  underlyingPrice?: number | null;
  getOptionChain: (symbol: string) => Promise<OptionChainInfo>;
  getOptionSnapshot: (spec: ContractSpec) => Promise<OptionSnapshot>;
  onAddToWatchlist: (spec: ContractSpec) => void;
  onClose: () => void;
}

const WINDOW_SIZE = 8; // strikes shown above and below the center

function fmt(n?: number | null, digits = 2) {
  return n == null ? "—" : n.toFixed(digits);
}

function snapshotKey(strike: number, right: "CALL" | "PUT") {
  return `${strike}-${right}`;
}

export function OptionsChainDialog({
  symbol,
  underlyingPrice,
  getOptionChain,
  getOptionSnapshot,
  onAddToWatchlist,
  onClose,
}: OptionsChainDialogProps) {
  useEscapeToClose(onClose);
  const [chain, setChain] = useState<OptionChainInfo | null>(null);
  const [expiry, setExpiry] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Record<string, OptionSnapshot>>({});
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getOptionChain(symbol)
      .then((info) => {
        if (cancelled) return;
        setChain(info);
        setExpiry(info.expirations[0] ?? "");
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [symbol, getOptionChain]);

  const visibleStrikes = useMemo(() => {
    if (!chain || chain.strikes.length === 0) return [];
    const strikes = chain.strikes;
    let centerIdx = Math.floor(strikes.length / 2);
    if (underlyingPrice != null) {
      let closest = 0;
      let closestDiff = Infinity;
      strikes.forEach((s, i) => {
        const diff = Math.abs(s - underlyingPrice);
        if (diff < closestDiff) {
          closestDiff = diff;
          closest = i;
        }
      });
      centerIdx = closest;
    }
    const start = Math.max(0, centerIdx - WINDOW_SIZE);
    const end = Math.min(strikes.length, centerIdx + WINDOW_SIZE + 1);
    return strikes.slice(start, end);
  }, [chain, underlyingPrice]);

  useEffect(() => {
    setSnapshots({});
  }, [expiry]);

  const loadSnapshots = async () => {
    if (!expiry || visibleStrikes.length === 0) return;
    setLoadingSnapshots(true);
    try {
      const results = await Promise.allSettled(
        visibleStrikes.flatMap((strike) => [
          getOptionSnapshot({ assetType: "OPTION", symbol, right: "CALL", strike, expiry }).then((s) => ({
            key: snapshotKey(strike, "CALL"),
            snapshot: s,
          })),
          getOptionSnapshot({ assetType: "OPTION", symbol, right: "PUT", strike, expiry }).then((s) => ({
            key: snapshotKey(strike, "PUT"),
            snapshot: s,
          })),
        ]),
      );
      setSnapshots((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r.status === "fulfilled") next[r.value.key] = r.value.snapshot;
        }
        return next;
      });
    } finally {
      setLoadingSnapshots(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card options-chain-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          Option Chain — {symbol}
          <button className="btn-icon options-chain-close" onClick={onClose}>
            ✕
          </button>
        </div>
        {loading && <div className="loading-banner">Loading chain…</div>}
        {error && <div className="error-banner">{error}</div>}
        {chain && (
          <>
            <div className="options-chain-controls">
              <label className="field">
                <span>Expiration</span>
                <select value={expiry} onChange={(e) => setExpiry(e.target.value)}>
                  {chain.expirations.map((exp) => (
                    <option key={exp} value={exp}>
                      {exp}
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn btn-secondary" onClick={loadSnapshots} disabled={loadingSnapshots}>
                {loadingSnapshots ? "Loading…" : "Load Quotes"}
              </button>
            </div>
            <div className="options-chain-table-wrap">
              <table className="data-table options-chain-table">
                <thead>
                  <tr>
                    <th>Delta</th>
                    <th>Bid</th>
                    <th>Ask</th>
                    <th></th>
                    <th>Strike</th>
                    <th></th>
                    <th>Bid</th>
                    <th>Ask</th>
                    <th>Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleStrikes.map((strike) => {
                    const call = snapshots[snapshotKey(strike, "CALL")];
                    const put = snapshots[snapshotKey(strike, "PUT")];
                    const isAtm = underlyingPrice != null && Math.abs(strike - underlyingPrice) < 0.01;
                    return (
                      <tr key={strike} className={isAtm ? "row-selected" : ""}>
                        <td>{fmt(call?.delta, 2)}</td>
                        <td>{fmt(call?.bid)}</td>
                        <td>{fmt(call?.ask)}</td>
                        <td>
                          <button
                            className="btn-icon"
                            title="Add call to watchlist"
                            onClick={() => onAddToWatchlist({ assetType: "OPTION", symbol, right: "CALL", strike, expiry })}
                          >
                            +
                          </button>
                        </td>
                        <td className="symbol-cell">{strike}</td>
                        <td>
                          <button
                            className="btn-icon"
                            title="Add put to watchlist"
                            onClick={() => onAddToWatchlist({ assetType: "OPTION", symbol, right: "PUT", strike, expiry })}
                          >
                            +
                          </button>
                        </td>
                        <td>{fmt(put?.bid)}</td>
                        <td>{fmt(put?.ask)}</td>
                        <td>{fmt(put?.delta, 2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

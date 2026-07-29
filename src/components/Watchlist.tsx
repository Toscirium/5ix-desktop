import { useEffect, useRef, useState } from "react";
import type { WatchlistGroup } from "../hooks/useWatchlistGroups";
import { OptionsChainDialog } from "./OptionsChainDialog";
import type { AssetType, ContractSpec, OptionChainInfo, OptionRight, OptionSnapshot, Quote, SymbolMatch, WatchlistItem } from "../types";

interface WatchlistProps {
  watchlist: WatchlistItem[];
  quotes: Record<string, Quote>;
  selectedKey: string | null;
  connected: boolean;
  searchSymbols: (pattern: string) => Promise<SymbolMatch[]>;
  getOptionChain: (symbol: string) => Promise<OptionChainInfo>;
  getOptionSnapshot: (spec: ContractSpec) => Promise<OptionSnapshot>;
  groups: WatchlistGroup[];
  activeGroupId: string;
  onSelectGroup: (id: string) => void;
  onAddGroup: (name: string) => void;
  onRemoveGroup: (id: string) => void;
  onSelect: (item: WatchlistItem) => void;
  onAdd: (spec: ContractSpec) => void;
  onRemove: (key: string) => void;
}

function fmt(n?: number | null, digits = 2) {
  return n == null ? "—" : n.toFixed(digits);
}

const ASSET_TYPES: AssetType[] = ["STOCK", "OPTION", "FUTURE", "FOREX", "CRYPTO"];
const SUGGESTION_DEBOUNCE_MS = 300;

export function Watchlist({
  watchlist,
  quotes,
  selectedKey,
  connected,
  searchSymbols,
  getOptionChain,
  getOptionSnapshot,
  groups,
  activeGroupId,
  onSelectGroup,
  onAddGroup,
  onRemoveGroup,
  onSelect,
  onAdd,
  onRemove,
}: WatchlistProps) {
  const [assetType, setAssetType] = useState<AssetType>("STOCK");
  const [symbol, setSymbol] = useState("");
  const [right, setRight] = useState<OptionRight>("CALL");
  const [strike, setStrike] = useState("");
  const [expiry, setExpiry] = useState("");
  const [contractMonth, setContractMonth] = useState("");
  const [chainSymbol, setChainSymbol] = useState<string | null>(null);
  const [quoteCurrency, setQuoteCurrency] = useState("USD");
  const [suggestions, setSuggestions] = useState<SymbolMatch[]>([]);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    const pattern = symbol.trim();
    if (!connected || pattern.length === 0) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      const results = await searchSymbols(pattern);
      setSuggestions(results);
    }, SUGGESTION_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current);
    };
  }, [symbol, connected, searchSymbols]);

  const canSubmit =
    connected &&
    symbol.trim() &&
    (assetType !== "OPTION" || (strike && expiry)) &&
    (assetType !== "FOREX" || quoteCurrency.trim());

  const submit = () => {
    if (!canSubmit) return;
    const spec: ContractSpec = { assetType, symbol: symbol.trim().toUpperCase() };
    if (assetType === "OPTION") {
      spec.right = right;
      spec.strike = Number(strike);
      spec.expiry = expiry;
    } else if (assetType === "FUTURE") {
      if (contractMonth.trim()) spec.contractMonth = contractMonth.trim();
    } else if (assetType === "FOREX") {
      spec.quoteCurrency = quoteCurrency.trim().toUpperCase();
    }
    onAdd(spec);
    setSymbol("");
    setStrike("");
    setExpiry("");
    setContractMonth("");
    setSuggestions([]);
  };

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? groups[0];
  const visibleWatchlist = watchlist.filter((item) => activeGroup?.keys.includes(item.key));

  const handleAddGroup = () => {
    const name = window.prompt("New watchlist name", `List ${groups.length + 1}`);
    if (name && name.trim()) onAddGroup(name.trim());
  };

  return (
    <div className="panel watchlist-panel">
      <div className="panel-header">
        <span>Watchlist</span>
      </div>
      <div className="watchlist-tabs">
        {groups.map((g) => (
          <button
            key={g.id}
            className={g.id === activeGroupId ? "watchlist-tab watchlist-tab-active" : "watchlist-tab"}
            onClick={() => onSelectGroup(g.id)}
          >
            {g.name}
            {groups.length > 1 && g.id === activeGroupId && (
              <span
                className="watchlist-tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveGroup(g.id);
                }}
              >
                ✕
              </span>
            )}
          </button>
        ))}
        <button className="watchlist-tab watchlist-tab-add" onClick={handleAddGroup} title="New watchlist">
          +
        </button>
      </div>
      <div className="watchlist-add">
        <select value={assetType} onChange={(e) => setAssetType(e.target.value as AssetType)} disabled={!connected} className="asset-type-select">
          {ASSET_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div className="symbol-input-wrap">
          <input
            id="watchlist-symbol-input"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            onBlur={() => window.setTimeout(() => setSuggestions([]), 150)}
            placeholder={assetType === "FOREX" ? "Base (e.g. EUR)" : "Symbol"}
            disabled={!connected}
          />
          {suggestions.length > 0 && (
            <div className="symbol-suggestions">
              {suggestions.map((s) => (
                <button
                  key={`${s.symbol}-${s.primaryExchange}-${s.currency}`}
                  type="button"
                  className="symbol-suggestion-row"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setSymbol(s.symbol);
                    setSuggestions([]);
                  }}
                >
                  <span className="symbol-cell">{s.symbol}</span>
                  <span className="text-muted">
                    {s.securityType} · {s.primaryExchange} · {s.currency}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {assetType === "OPTION" && (
        <div className="watchlist-add watchlist-add-sub">
          <select value={right} onChange={(e) => setRight(e.target.value as OptionRight)} disabled={!connected}>
            <option value="CALL">Call</option>
            <option value="PUT">Put</option>
          </select>
          <input
            type="number"
            value={strike}
            onChange={(e) => setStrike(e.target.value)}
            placeholder="Strike"
            disabled={!connected}
          />
          <input
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            disabled={!connected}
          />
        </div>
      )}
      {assetType === "FUTURE" && (
        <div className="watchlist-add watchlist-add-sub">
          <input
            value={contractMonth}
            onChange={(e) => setContractMonth(e.target.value)}
            placeholder="Contract month YYYY-MM (blank = front month)"
            disabled={!connected}
          />
        </div>
      )}
      {assetType === "FOREX" && (
        <div className="watchlist-add watchlist-add-sub">
          <input
            value={quoteCurrency}
            onChange={(e) => setQuoteCurrency(e.target.value.toUpperCase())}
            placeholder="Quote currency (e.g. USD)"
            disabled={!connected}
          />
        </div>
      )}
      <div className="watchlist-add-submit">
        <button className="btn btn-secondary" onClick={submit} disabled={!canSubmit}>
          Add to Watchlist
        </button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Last</th>
            <th>Bid</th>
            <th>Ask</th>
            <th>Volume</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {visibleWatchlist.length === 0 && (
            <tr>
              <td colSpan={6} className="empty-row">
                {connected ? "No symbols in this list yet" : "Connect to add symbols"}
              </td>
            </tr>
          )}
          {visibleWatchlist.map((item) => {
            const q = quotes[item.key];
            const change = q?.last != null && q?.close != null ? q.last - q.close : null;
            const changeClass = change == null ? "" : change >= 0 ? "text-up" : "text-down";
            return (
              <tr key={item.key} className={item.key === selectedKey ? "row-selected" : ""} onClick={() => onSelect(item)}>
                <td className="symbol-cell">{item.label}</td>
                <td className={changeClass}>{fmt(q?.last)}</td>
                <td>{fmt(q?.bid)}</td>
                <td>{fmt(q?.ask)}</td>
                <td>{fmt(q?.volume, 0)}</td>
                <td>
                  <div className="row-actions">
                    {item.spec.assetType === "STOCK" && (
                      <button
                        className="btn-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setChainSymbol(item.spec.symbol);
                        }}
                        title="View option chain"
                      >
                        Ω
                      </button>
                    )}
                    <button
                      className="btn-icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(item.key);
                      }}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {chainSymbol && (
        <OptionsChainDialog
          symbol={chainSymbol}
          underlyingPrice={quotes[`STK|${chainSymbol}`]?.last}
          getOptionChain={getOptionChain}
          getOptionSnapshot={getOptionSnapshot}
          onAddToWatchlist={onAdd}
          onClose={() => setChainSymbol(null)}
        />
      )}
    </div>
  );
}

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadJSON, saveJSON } from "../lib/storage";
import { notify } from "../lib/notify";
import { contractKey, contractLabel } from "../types";
import type {
  AccountValue,
  ActivityEntry,
  ActivityLevel,
  AlgoOptions,
  Bar,
  BarSizeOption,
  BracketOrderIds,
  ConnectionStatus,
  ContractSpec,
  DepthBook,
  Execution,
  NewsArticleHeadline,
  OpenOrder,
  OptionChainInfo,
  OptionSnapshot,
  OrderSide,
  OrderType,
  OrderUpdate,
  Pnl,
  Position,
  Quote,
  ScannerRow,
  SymbolMatch,
  WatchlistItem,
} from "../types";

const WATCHLIST_KEY = "5ix-watchlist";
const HEALTH_CHECK_INTERVAL_MS = 8000;
const RECONNECT_BASE_DELAY_S = 3;
const RECONNECT_MAX_DELAY_S = 30;

export function useIbkr() {
  const [connection, setConnection] = useState<ConnectionStatus>({ connected: false });
  const [connecting, setConnecting] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>(() => loadJSON<WatchlistItem[]>(WATCHLIST_KEY, []));
  const [positions, setPositions] = useState<Position[]>([]);
  const [accountSummary, setAccountSummary] = useState<AccountValue[]>([]);
  const [orderLog, setOrderLog] = useState<OrderUpdate[]>([]);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [pnl, setPnl] = useState<Pnl | null>(null);
  const [depthBook, setDepthBook] = useState<DepthBook | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);

  const watchlistRef = useRef<WatchlistItem[]>([]);
  watchlistRef.current = watchlist;

  const lastParamsRef = useRef<{ host: string; port: number; clientId: number } | null>(null);
  const manualDisconnectRef = useRef(false);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const activityIdRef = useRef(0);

  const logActivity = useCallback((level: ActivityLevel, message: string) => {
    activityIdRef.current += 1;
    const entry: ActivityEntry = { id: activityIdRef.current, time: Date.now(), level, message };
    setActivityLog((prev) => [entry, ...prev].slice(0, 300));
  }, []);

  const clearActivityLog = useCallback(() => setActivityLog([]), []);

  const reportError = useCallback(
    (message: string) => {
      setLastError(message);
      logActivity("error", message);
    },
    [logActivity],
  );

  useEffect(() => {
    saveJSON(WATCHLIST_KEY, watchlist);
  }, [watchlist]);

  useEffect(() => {
    const unlisteners = [
      listen<ConnectionStatus>("connection-status", (event) => {
        setConnection(event.payload);
        if (event.payload.error) setLastError(event.payload.error);
        setSelectedAccount((prev) => {
          const accounts = event.payload.accounts ?? [];
          if (prev && accounts.includes(prev)) return prev;
          return accounts[0] ?? null;
        });
      }),
      listen<Quote>("quote-update", (event) => {
        setQuotes((prev) => ({ ...prev, [event.payload.key]: { ...prev[event.payload.key], ...event.payload } }));
      }),
      listen<OrderUpdate>("order-update", (event) => {
        setOrderLog((prev) => [event.payload, ...prev].slice(0, 200));
        const u = event.payload;
        if (u.kind === "execution") {
          notify(`Order filled: ${u.symbol ?? ""}`, `${u.side} ${u.shares} @ ${u.price}`);
        }
      }),
      listen<string>("watchlist-error", (event) => reportError(event.payload)),
      listen<string>("order-update-error", (event) => reportError(event.payload)),
      listen<Pnl>("pnl-update", (event) => setPnl(event.payload)),
      listen<string>("pnl-error", (event) => reportError(event.payload)),
      listen<DepthBook>("depth-update", (event) => setDepthBook(event.payload)),
      listen<string>("depth-error", (event) => reportError(event.payload)),
    ];

    return () => {
      unlisteners.forEach((p) => p.then((un) => un()));
    };
  }, [reportError]);

  const resubscribeWatchlist = useCallback(async () => {
    for (const item of watchlistRef.current) {
      try {
        await invoke("add_watchlist_instrument", { key: item.key, label: item.label, spec: item.spec });
      } catch (e) {
        logActivity("error", `Failed to resubscribe ${item.label}: ${String(e)}`);
      }
    }
  }, [logActivity]);

  const performConnect = useCallback(
    async (host: string, port: number, clientId: number, opts?: { silent?: boolean }): Promise<boolean> => {
      try {
        const status = await invoke<ConnectionStatus>("ibkr_connect", { host, port, clientId });
        setConnection(status);
        lastParamsRef.current = { host, port, clientId };
        manualDisconnectRef.current = false;
        reconnectAttemptRef.current = 0;
        logActivity("success", `Connected to IB Gateway (server v${status.serverVersion ?? "?"})`);
        if (opts?.silent) notify("Reconnected to IB Gateway");
        await resubscribeWatchlist();
        return true;
      } catch (e) {
        if (!opts?.silent) {
          reportError(String(e));
          setConnection({ connected: false, error: String(e) });
        } else {
          logActivity("error", `Reconnect failed: ${String(e)}`);
        }
        return false;
      }
    },
    [logActivity, reportError, resubscribeWatchlist],
  );

  const attemptReconnect = useCallback(() => {
    if (manualDisconnectRef.current || !lastParamsRef.current) return;
    if (reconnectTimerRef.current != null) return;

    const attempt = reconnectAttemptRef.current + 1;
    reconnectAttemptRef.current = attempt;
    const delaySec = Math.min(RECONNECT_BASE_DELAY_S * 2 ** (attempt - 1), RECONNECT_MAX_DELAY_S);
    logActivity("error", `Connection lost — retrying in ${delaySec}s (attempt ${attempt})`);
    if (attempt === 1) notify("Connection to IB Gateway lost", "Attempting to reconnect…");
    setConnection({ connected: false });

    reconnectTimerRef.current = window.setTimeout(async () => {
      reconnectTimerRef.current = null;
      if (manualDisconnectRef.current || !lastParamsRef.current) return;
      const { host, port, clientId } = lastParamsRef.current;
      const ok = await performConnect(host, port, clientId, { silent: true });
      if (!ok) attemptReconnect();
    }, delaySec * 1000);
  }, [logActivity, performConnect]);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      if (!connection.connected || manualDisconnectRef.current) return;
      try {
        const alive = await invoke<boolean>("is_connected");
        if (!alive) attemptReconnect();
      } catch {
        attemptReconnect();
      }
    }, HEALTH_CHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [connection.connected, attemptReconnect]);

  useEffect(() => {
    if (!connection.connected || !selectedAccount) return;
    invoke("subscribe_pnl", { account: selectedAccount }).catch((e) => reportError(String(e)));
  }, [connection.connected, selectedAccount, reportError]);

  const connect = useCallback(
    async (host: string, port: number, clientId: number) => {
      setConnecting(true);
      setLastError(null);
      await performConnect(host, port, clientId);
      setConnecting(false);
    },
    [performConnect],
  );

  const disconnect = useCallback(async () => {
    manualDisconnectRef.current = true;
    if (reconnectTimerRef.current != null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    try {
      await invoke("ibkr_disconnect");
      logActivity("info", "Disconnected");
    } catch (e) {
      reportError(String(e));
    } finally {
      setConnection({ connected: false });
      setQuotes({});
      setPositions([]);
      setAccountSummary([]);
      setOpenOrders([]);
      setSelectedAccount(null);
      setPnl(null);
      setDepthBook(null);
    }
  }, [logActivity, reportError]);

  const selectAccount = useCallback(
    async (account: string) => {
      try {
        await invoke("select_account", { account });
        setSelectedAccount(account);
      } catch (e) {
        reportError(String(e));
      }
    },
    [reportError],
  );

  const addInstrument = useCallback(
    async (spec: ContractSpec) => {
      const key = contractKey(spec);
      const label = contractLabel(spec);
      if (watchlistRef.current.some((w) => w.key === key)) return;
      try {
        await invoke("add_watchlist_instrument", { key, label, spec });
        setWatchlist((prev) => [...prev, { key, label, spec }]);
        setQuotes((prev) => ({ ...prev, [key]: prev[key] ?? { key, symbol: label } }));
        logActivity("info", `Added ${label} to watchlist`);
      } catch (e) {
        reportError(String(e));
      }
    },
    [logActivity, reportError],
  );

  const removeInstrument = useCallback(
    async (key: string) => {
      const label = watchlistRef.current.find((w) => w.key === key)?.label ?? key;
      try {
        await invoke("remove_watchlist_instrument", { key });
      } catch (e) {
        reportError(String(e));
      } finally {
        setWatchlist((prev) => prev.filter((w) => w.key !== key));
        setQuotes((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        logActivity("info", `Removed ${label} from watchlist`);
      }
    },
    [logActivity, reportError],
  );

  const placeOrder = useCallback(
    async (
      spec: ContractSpec,
      side: OrderSide,
      quantity: number,
      orderType: OrderType,
      limitPrice?: number,
      auxPrice?: number,
      trailingPercent?: number,
      algo?: AlgoOptions,
    ) => {
      try {
        const orderId = await invoke<number>("place_order", {
          spec,
          side,
          quantity,
          orderType,
          limitPrice: limitPrice ?? null,
          auxPrice: auxPrice ?? null,
          trailingPercent: trailingPercent ?? null,
          algoStrategy: algo?.strategy ?? null,
          algoStartTime: algo?.startTime ?? null,
          algoEndTime: algo?.endTime ?? null,
          algoMaxPctVol: algo?.maxPctVol ?? null,
        });
        const algoSuffix = algo ? ` [${algo.strategy}]` : "";
        logActivity("success", `Order #${orderId} submitted: ${side} ${quantity} ${spec.symbol} (${orderType})${algoSuffix}`);
        return orderId;
      } catch (e) {
        reportError(String(e));
        throw e;
      }
    },
    [logActivity, reportError],
  );

  const placeBracketOrder = useCallback(
    async (spec: ContractSpec, side: OrderSide, quantity: number, entryPrice: number | undefined, takeProfit: number, stopLoss: number) => {
      try {
        const ids = await invoke<BracketOrderIds>("place_bracket_order", {
          spec,
          side,
          quantity,
          entryPrice: entryPrice ?? null,
          takeProfit,
          stopLoss,
        });
        logActivity(
          "success",
          `Bracket order #${ids.parentId} submitted: ${side} ${quantity} ${spec.symbol} (TP #${ids.takeProfitId} @ ${takeProfit}, SL #${ids.stopLossId} @ ${stopLoss})`,
        );
        return ids;
      } catch (e) {
        reportError(String(e));
        throw e;
      }
    },
    [logActivity, reportError],
  );

  const refreshPositions = useCallback(async () => {
    try {
      const result = await invoke<Position[]>("get_positions");
      setPositions(result);
    } catch (e) {
      reportError(String(e));
    }
  }, [reportError]);

  const refreshAccountSummary = useCallback(async () => {
    try {
      const result = await invoke<AccountValue[]>("get_account_summary");
      setAccountSummary(result);
    } catch (e) {
      reportError(String(e));
    }
  }, [reportError]);

  const fetchHistoricalBars = useCallback(async (spec: ContractSpec, barSize: BarSizeOption, durationDays: number) => {
    return invoke<Bar[]>("get_historical_bars", { spec, barSize, durationDays });
  }, []);

  const fetchNews = useCallback(async (spec: ContractSpec, days: number) => {
    return invoke<NewsArticleHeadline[]>("get_news", { spec, days });
  }, []);

  const fetchNewsArticle = useCallback(async (providerCode: string, articleId: string) => {
    return invoke<string>("get_news_article", { providerCode, articleId });
  }, []);

  const searchSymbols = useCallback(async (pattern: string) => {
    try {
      return await invoke<SymbolMatch[]>("search_symbols", { pattern });
    } catch {
      // Autocomplete is best-effort — fail quietly (e.g. not connected yet).
      return [];
    }
  }, []);

  const getOptionChain = useCallback(
    async (symbol: string) => {
      try {
        return await invoke<OptionChainInfo>("get_option_chain", { symbol });
      } catch (e) {
        reportError(String(e));
        throw e;
      }
    },
    [reportError],
  );

  const getOptionSnapshot = useCallback(async (spec: ContractSpec) => {
    return invoke<OptionSnapshot>("get_option_snapshot", { spec });
  }, []);

  const runScanner = useCallback(
    async (scanCode: string, instrument: string, locationCode: string, numberOfRows: number) => {
      try {
        return await invoke<ScannerRow[]>("run_scanner", { scanCode, instrument, locationCode, numberOfRows });
      } catch (e) {
        reportError(String(e));
        throw e;
      }
    },
    [reportError],
  );

  const refreshOpenOrders = useCallback(async () => {
    try {
      const result = await invoke<OpenOrder[]>("get_open_orders");
      setOpenOrders(result);
    } catch (e) {
      reportError(String(e));
    }
  }, [reportError]);

  const fetchExecutions = useCallback(
    async (days: number) => {
      try {
        return await invoke<Execution[]>("get_executions", { days });
      } catch (e) {
        reportError(String(e));
        throw e;
      }
    },
    [reportError],
  );

  const cancelOrder = useCallback(
    async (orderId: number) => {
      try {
        await invoke("cancel_order", { orderId });
        logActivity("info", `Order #${orderId} cancel requested`);
        await refreshOpenOrders();
      } catch (e) {
        reportError(String(e));
        throw e;
      }
    },
    [logActivity, reportError, refreshOpenOrders],
  );

  const modifyOrder = useCallback(
    async (
      orderId: number,
      side: OrderSide,
      quantity: number,
      orderType: OrderType,
      limitPrice?: number,
      auxPrice?: number,
      trailingPercent?: number,
    ) => {
      try {
        await invoke("modify_order", {
          orderId,
          side,
          quantity,
          orderType,
          limitPrice: limitPrice ?? null,
          auxPrice: auxPrice ?? null,
          trailingPercent: trailingPercent ?? null,
        });
        logActivity("info", `Order #${orderId} modified`);
        await refreshOpenOrders();
      } catch (e) {
        reportError(String(e));
        throw e;
      }
    },
    [logActivity, reportError, refreshOpenOrders],
  );

  const subscribeMarketDepth = useCallback(
    async (spec: ContractSpec, rows: number) => {
      try {
        setDepthBook(null);
        await invoke("subscribe_market_depth", { spec, rows });
      } catch (e) {
        reportError(String(e));
      }
    },
    [reportError],
  );

  const unsubscribeMarketDepth = useCallback(async () => {
    setDepthBook(null);
    try {
      await invoke("unsubscribe_market_depth");
    } catch {
      // best-effort cleanup
    }
  }, []);

  return {
    connection,
    connecting,
    quotes,
    watchlist,
    positions,
    accountSummary,
    orderLog,
    openOrders,
    selectedAccount,
    pnl,
    depthBook,
    lastError,
    activityLog,
    connect,
    disconnect,
    selectAccount,
    addInstrument,
    removeInstrument,
    placeOrder,
    placeBracketOrder,
    refreshPositions,
    refreshAccountSummary,
    fetchHistoricalBars,
    refreshOpenOrders,
    cancelOrder,
    modifyOrder,
    runScanner,
    searchSymbols,
    getOptionChain,
    getOptionSnapshot,
    fetchNews,
    fetchNewsArticle,
    fetchExecutions,
    clearActivityLog,
    subscribeMarketDepth,
    unsubscribeMarketDepth,
  };
}

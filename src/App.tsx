import { useEffect, useRef, useState, type ReactNode } from "react";
import "./App.css";
import { AccountSummaryPanel } from "./components/AccountSummaryPanel";
import { ActivityLogPanel } from "./components/ActivityLogPanel";
import { ColumnResizer } from "./components/ColumnResizer";
import { ConnectionBar } from "./components/ConnectionBar";
import { MarketDepthPanel } from "./components/MarketDepthPanel";
import { NewsPanel } from "./components/NewsPanel";
import { OpenOrdersPanel } from "./components/OpenOrdersPanel";
import { OrderTicket } from "./components/OrderTicket";
import { PositionsPanel } from "./components/PositionsPanel";
import { PriceAlertsPanel } from "./components/PriceAlertsPanel";
import { PriceChart } from "./components/PriceChart";
import { ScannerPanel } from "./components/ScannerPanel";
import { TradeBlotterPanel } from "./components/TradeBlotterPanel";
import { Watchlist } from "./components/Watchlist";
import { useIbkr } from "./hooks/useIbkr";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { usePriceAlerts } from "./hooks/usePriceAlerts";
import { useSettings } from "./hooks/useSettings";
import { useTheme } from "./hooks/useTheme";
import { useWatchlistGroups } from "./hooks/useWatchlistGroups";
import { loadJSON, saveJSON } from "./lib/storage";
import { isDetachedPanelId, openDetachedWindow } from "./lib/detachedWindows";
import type { DetachedPanelId } from "./lib/detachedWindows";
import { contractKey } from "./types";
import type { ContractSpec, WatchlistItem } from "./types";

const PANEL_WIDTHS_KEY = "5ix-panel-widths";
const MIN_COL_WIDTH = 220;
const MAX_LEFT_WIDTH = 480;
const MAX_RIGHT_WIDTH = 460;

interface PanelWidths {
  left: number;
  right: number;
}

const DEFAULT_PANEL_WIDTHS: PanelWidths = { left: 320, right: 300 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function DetachablePanel({ panel, children }: { panel: DetachedPanelId; children: ReactNode }) {
  return (
    <section className="detachable-panel" data-panel={panel}>
      <button
        className="detach-panel-button"
        type="button"
        title="Open in a new window"
        aria-label="Open panel in a new window"
        onClick={() => void openDetachedWindow(panel)}
      >
        ↗
      </button>
      {children}
    </section>
  );
}

export default function App() {
  const detachedPanelParam = new URLSearchParams(window.location.search).get("panel");
  const detachedPanel = isDetachedPanelId(detachedPanelParam) ? detachedPanelParam : null;
  const { theme, toggleTheme } = useTheme();
  const {
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
  } = useIbkr();

  const { groups, activeGroup, selectGroup, addGroup, removeGroup, addKeyToActiveGroup, removeKeyFromActiveGroup } =
    useWatchlistGroups();
  const { alerts, addAlert, removeAlert } = usePriceAlerts(quotes);
  const { settings, updateSettings } = useSettings();

  const [selected, setSelected] = useState<WatchlistItem | null>(null);
  const [panelWidths, setPanelWidths] = useState<PanelWidths>(() => loadJSON(PANEL_WIDTHS_KEY, DEFAULT_PANEL_WIDTHS));
  const panelWidthsRef = useRef(panelWidths);
  panelWidthsRef.current = panelWidths;

  const visibleWatchlist = watchlist.filter((item) => activeGroup?.keys.includes(item.key));

  const handleLeftResize = (deltaX: number) => {
    setPanelWidths((prev) => ({ ...prev, left: clamp(prev.left + deltaX, MIN_COL_WIDTH, MAX_LEFT_WIDTH) }));
  };
  const handleRightResize = (deltaX: number) => {
    setPanelWidths((prev) => ({ ...prev, right: clamp(prev.right - deltaX, MIN_COL_WIDTH, MAX_RIGHT_WIDTH) }));
  };
  const handleResizeEnd = () => saveJSON(PANEL_WIDTHS_KEY, panelWidthsRef.current);

  useEffect(() => {
    if (connection.connected) {
      refreshPositions();
      refreshAccountSummary();
      refreshOpenOrders();
    }
  }, [connection.connected, refreshPositions, refreshAccountSummary, refreshOpenOrders]);

  useEffect(() => {
    if (!selected && visibleWatchlist.length > 0) setSelected(visibleWatchlist[0]);
    if (selected && !visibleWatchlist.some((w) => w.key === selected.key)) setSelected(visibleWatchlist[0] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleWatchlist, selected]);

  useEffect(() => {
    if (!connection.connected || !selected) return;
    subscribeMarketDepth(selected.spec, 10);
    return () => {
      unsubscribeMarketDepth();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connection.connected, selected?.key]);

  const handleAddToWatchlist = async (spec: ContractSpec) => {
    await addInstrument(spec);
    addKeyToActiveGroup(contractKey(spec));
  };

  const handleRemoveFromWatchlist = (key: string) => {
    const orphaned = removeKeyFromActiveGroup(key);
    if (orphaned) removeInstrument(key);
  };

  useKeyboardShortcuts({
    onFocusSearch: () => document.getElementById("watchlist-symbol-input")?.focus(),
    onNavigateUp: () => {
      setSelected((prev) => {
        if (!prev) return visibleWatchlist[0] ?? null;
        const idx = visibleWatchlist.findIndex((w) => w.key === prev.key);
        return visibleWatchlist[Math.max(0, idx - 1)] ?? prev;
      });
    },
    onNavigateDown: () => {
      setSelected((prev) => {
        if (!prev) return visibleWatchlist[0] ?? null;
        const idx = visibleWatchlist.findIndex((w) => w.key === prev.key);
        return visibleWatchlist[Math.min(visibleWatchlist.length - 1, idx + 1)] ?? prev;
      });
    },
    onToggleTheme: toggleTheme,
    onRefresh: () => {
      if (connection.connected) {
        refreshPositions();
        refreshAccountSummary();
        refreshOpenOrders();
      }
    },
    onSelectGroupIndex: (index) => {
      const group = groups[index];
      if (group) selectGroup(group.id);
    },
  });

  return (
    <div className="app-shell" data-detached-panel={detachedPanel ?? undefined}>
      <ConnectionBar
        connection={connection}
        connecting={connecting}
        selectedAccount={selectedAccount}
        theme={theme}
        settings={settings}
        onConnect={connect}
        onDisconnect={disconnect}
        onSelectAccount={selectAccount}
        onToggleTheme={toggleTheme}
        onChangeSettings={updateSettings}
      />
      {lastError && <div className="error-banner global-error">{lastError}</div>}
      <main
        className="app-grid"
        style={{ gridTemplateColumns: `${panelWidths.left}px 5px 1fr 5px ${panelWidths.right}px` }}
      >
        <div className="col col-left">
          <DetachablePanel panel="watchlist"><Watchlist
            watchlist={watchlist}
            quotes={quotes}
            selectedKey={selected?.key ?? null}
            connected={connection.connected}
            searchSymbols={searchSymbols}
            getOptionChain={getOptionChain}
            getOptionSnapshot={getOptionSnapshot}
            groups={groups}
            activeGroupId={activeGroup?.id ?? ""}
            onSelectGroup={selectGroup}
            onAddGroup={addGroup}
            onRemoveGroup={removeGroup}
            onSelect={setSelected}
            onAdd={handleAddToWatchlist}
            onRemove={handleRemoveFromWatchlist}
          /></DetachablePanel>
          <DetachablePanel panel="positions"><PositionsPanel
            positions={positions}
            connected={connection.connected}
            selectedAccount={selectedAccount}
            onRefresh={refreshPositions}
          /></DetachablePanel>
          <DetachablePanel panel="account"><AccountSummaryPanel
            accountSummary={accountSummary}
            pnl={pnl}
            connected={connection.connected}
            selectedAccount={selectedAccount}
            onRefresh={refreshAccountSummary}
          /></DetachablePanel>
          <DetachablePanel panel="alerts"><PriceAlertsPanel alerts={alerts} watchlist={visibleWatchlist} onAdd={addAlert} onRemove={removeAlert} /></DetachablePanel>
        </div>
        <ColumnResizer onResize={handleLeftResize} onResizeEnd={handleResizeEnd} />
        <div className="col col-center">
          <DetachablePanel panel="chart"><PriceChart
            label={selected?.label ?? null}
            spec={selected?.spec ?? null}
            connected={connection.connected}
            theme={theme}
            fetchHistoricalBars={fetchHistoricalBars}
          /></DetachablePanel>
          <DetachablePanel panel="orders"><OpenOrdersPanel
            openOrders={openOrders}
            connected={connection.connected}
            onRefresh={refreshOpenOrders}
            onCancel={cancelOrder}
            onModify={modifyOrder}
          /></DetachablePanel>
          <DetachablePanel panel="blotter"><TradeBlotterPanel connected={connection.connected} fetchExecutions={fetchExecutions} /></DetachablePanel>
          <DetachablePanel panel="news"><NewsPanel
            label={selected?.label ?? null}
            spec={selected?.spec ?? null}
            connected={connection.connected}
            fetchNews={fetchNews}
            fetchNewsArticle={fetchNewsArticle}
          /></DetachablePanel>
        </div>
        <ColumnResizer onResize={handleRightResize} onResizeEnd={handleResizeEnd} />
        <div className="col col-right">
          <DetachablePanel panel="ticket"><OrderTicket
            label={selected?.label ?? null}
            spec={selected?.spec ?? null}
            quote={selected ? quotes[selected.key] : undefined}
            connected={connection.connected}
            settings={settings}
            onSubmit={placeOrder}
            orderLog={orderLog}
          /></DetachablePanel>
          <DetachablePanel panel="depth"><MarketDepthPanel connected={connection.connected} symbolLabel={selected?.label ?? null} depthBook={depthBook} /></DetachablePanel>
          <DetachablePanel panel="scanner"><ScannerPanel connected={connection.connected} onRun={runScanner} onAddToWatchlist={handleAddToWatchlist} /></DetachablePanel>
          <DetachablePanel panel="activity"><ActivityLogPanel activityLog={activityLog} onClear={clearActivityLog} /></DetachablePanel>
        </div>
      </main>
    </div>
  );
}

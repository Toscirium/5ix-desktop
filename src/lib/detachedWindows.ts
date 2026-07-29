import { emitTo } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { loadJSON, saveJSON } from "./storage";

export const DETACHABLE_PANELS = [
  "watchlist",
  "positions",
  "account",
  "alerts",
  "chart",
  "orders",
  "blotter",
  "news",
  "ticket",
  "depth",
  "tape",
  "scanner",
  "activity",
] as const;

export type DetachedPanelId = (typeof DETACHABLE_PANELS)[number];

export interface DetachedPanelContext {
  symbolKey?: string | null;
  account?: string | null;
}

interface WindowOptions {
  title: string;
  width: number;
  height: number;
}

interface WindowLayout {
  width: number;
  height: number;
  x: number;
  y: number;
}

const WINDOW_LAYOUT_PREFIX = "5ix-detached-window-";
export const DETACHED_PANEL_CONTEXT_EVENT = "detached-panel-context";

export const PANEL_TITLES: Record<DetachedPanelId, string> = {
  watchlist: "Watchlist",
  positions: "Positions",
  account: "Account Summary",
  alerts: "Price Alerts",
  chart: "Chart",
  orders: "Open Orders",
  blotter: "Trade Blotter",
  news: "News",
  ticket: "Order Ticket",
  depth: "Market Depth",
  tape: "Time & Sales",
  scanner: "Market Scanner",
  activity: "Activity Log",
};

const WINDOW_OPTIONS: Record<DetachedPanelId, WindowOptions> = {
  watchlist: { title: PANEL_TITLES.watchlist, width: 520, height: 720 },
  positions: { title: PANEL_TITLES.positions, width: 760, height: 520 },
  account: { title: PANEL_TITLES.account, width: 620, height: 620 },
  alerts: { title: PANEL_TITLES.alerts, width: 560, height: 540 },
  chart: { title: PANEL_TITLES.chart, width: 1000, height: 680 },
  orders: { title: PANEL_TITLES.orders, width: 940, height: 560 },
  blotter: { title: PANEL_TITLES.blotter, width: 940, height: 560 },
  news: { title: PANEL_TITLES.news, width: 800, height: 640 },
  ticket: { title: PANEL_TITLES.ticket, width: 500, height: 720 },
  depth: { title: PANEL_TITLES.depth, width: 600, height: 620 },
  tape: { title: PANEL_TITLES.tape, width: 520, height: 640 },
  scanner: { title: PANEL_TITLES.scanner, width: 760, height: 660 },
  activity: { title: PANEL_TITLES.activity, width: 720, height: 560 },
};

function layoutKey(panel: DetachedPanelId) {
  return `${WINDOW_LAYOUT_PREFIX}${panel}`;
}

function saveLayout(panel: DetachedPanelId, window: WebviewWindow) {
  void Promise.all([window.outerSize(), window.outerPosition()])
    .then(([size, position]) => saveJSON(layoutKey(panel), { width: size.width, height: size.height, x: position.x, y: position.y }))
    .catch(() => undefined);
}

function waitForWindowCreation(window: WebviewWindow): Promise<void> {
  return new Promise((resolve, reject) => {
    void window.once("tauri://created", () => resolve());
    void window.once("tauri://error", (event) => reject(event.payload));
  });
}

export function isDetachedPanelId(value: string | null): value is DetachedPanelId {
  return value !== null && DETACHABLE_PANELS.includes(value as DetachedPanelId);
}

export async function openDetachedWindow(panel: DetachedPanelId, context: DetachedPanelContext = {}): Promise<void> {
  const label = `panel-${panel}`;
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) {
    await emitTo(label, DETACHED_PANEL_CONTEXT_EVENT, context);
    await existing.show();
    await existing.setFocus();
    return;
  }

  const options = WINDOW_OPTIONS[panel];
  const layout = loadJSON<WindowLayout | null>(layoutKey(panel), null);
  const url = new URL(window.location.href);
  url.searchParams.set("panel", panel);
  if (context.symbolKey) url.searchParams.set("symbol", context.symbolKey);
  if (context.account) url.searchParams.set("account", context.account);

  const detachedWindow = new WebviewWindow(label, {
    url: url.toString(),
    title: `5ix — ${options.title}`,
    width: layout?.width ?? options.width,
    height: layout?.height ?? options.height,
    x: layout?.x,
    y: layout?.y,
    minWidth: 400,
    minHeight: 320,
    center: !layout,
  });
  await waitForWindowCreation(detachedWindow);
  void detachedWindow.onMoved(() => saveLayout(panel, detachedWindow));
  void detachedWindow.onResized(() => saveLayout(panel, detachedWindow));
}

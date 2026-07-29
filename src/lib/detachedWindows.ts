import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

export const DETACHABLE_PANELS = [
  "watchlist", "positions", "account", "alerts", "chart", "orders", "blotter", "news", "ticket", "depth", "scanner", "activity",
] as const;

export type DetachedPanelId = (typeof DETACHABLE_PANELS)[number];

interface WindowOptions { title: string; width: number; height: number; }

const WINDOW_OPTIONS: Record<DetachedPanelId, WindowOptions> = {
  watchlist: { title: "Watchlist", width: 520, height: 720 }, positions: { title: "Positions", width: 760, height: 520 },
  account: { title: "Account Summary", width: 620, height: 620 }, alerts: { title: "Price Alerts", width: 560, height: 540 },
  chart: { title: "Chart", width: 1000, height: 680 }, orders: { title: "Open Orders", width: 940, height: 560 },
  blotter: { title: "Trade Blotter", width: 940, height: 560 }, news: { title: "News", width: 800, height: 640 },
  ticket: { title: "Order Ticket", width: 500, height: 720 }, depth: { title: "Market Depth", width: 600, height: 620 },
  scanner: { title: "Market Scanner", width: 760, height: 660 }, activity: { title: "Activity Log", width: 720, height: 560 },
};

export function isDetachedPanelId(value: string | null): value is DetachedPanelId {
  return value !== null && DETACHABLE_PANELS.includes(value as DetachedPanelId);
}

export async function openDetachedWindow(panel: DetachedPanelId): Promise<void> {
  const options = WINDOW_OPTIONS[panel];
  const label = `panel-${panel}`;
  const existing = await WebviewWindow.getByLabel(label);
  if (existing) { await existing.show(); await existing.setFocus(); return; }
  const url = new URL(window.location.href);
  url.searchParams.set("panel", panel);
  new WebviewWindow(label, { url: url.toString(), title: `5ix — ${options.title}`, width: options.width, height: options.height, minWidth: 400, minHeight: 320, center: true });
}

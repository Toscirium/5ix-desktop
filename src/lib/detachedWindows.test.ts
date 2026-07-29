import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const getByLabel = vi.fn();
  const emitTo = vi.fn();
  const createdWindows: { label: string; options: Record<string, unknown>; show: ReturnType<typeof vi.fn>; setFocus: ReturnType<typeof vi.fn> }[] = [];
  class MockWebviewWindow {
    static getByLabel = getByLabel;
    label: string;
    options: Record<string, unknown>;
    show = vi.fn();
    setFocus = vi.fn();
    outerSize = vi.fn().mockResolvedValue({ width: 800, height: 600 });
    outerPosition = vi.fn().mockResolvedValue({ x: 20, y: 30 });
    onMoved = vi.fn();
    onResized = vi.fn();
    once = vi.fn(async (event: string, callback: (event: { payload: unknown }) => void) => {
      if (event === "tauri://created") queueMicrotask(() => callback({ payload: null }));
      return () => undefined;
    });

    constructor(label: string, options: Record<string, unknown>) {
      this.label = label;
      this.options = options;
      createdWindows.push(this);
    }
  }
  return { getByLabel, emitTo, createdWindows, MockWebviewWindow };
});

vi.mock("@tauri-apps/api/event", () => ({ emitTo: mocks.emitTo }));
vi.mock("@tauri-apps/api/webviewWindow", () => ({ WebviewWindow: mocks.MockWebviewWindow }));

import { openDetachedWindow } from "./detachedWindows";

describe("openDetachedWindow", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.getByLabel.mockReset();
    mocks.emitTo.mockReset();
    mocks.createdWindows.length = 0;
  });

  it("updates and focuses an existing panel window", async () => {
    const existing = new mocks.MockWebviewWindow("panel-chart", {});
    mocks.getByLabel.mockResolvedValue(existing);

    await openDetachedWindow("chart", { symbolKey: "AAPL-STK", account: "DU123" });

    expect(mocks.emitTo).toHaveBeenCalledWith("panel-chart", "detached-panel-context", { symbolKey: "AAPL-STK", account: "DU123" });
    expect(existing.show).toHaveBeenCalledOnce();
    expect(existing.setFocus).toHaveBeenCalledOnce();
  });

  it("restores the saved placement when creating a panel window", async () => {
    localStorage.setItem("5ix-detached-window-chart", JSON.stringify({ width: 900, height: 700, x: 50, y: 70 }));
    mocks.getByLabel.mockResolvedValue(null);

    await openDetachedWindow("chart", { symbolKey: "AAPL-STK" });

    expect(mocks.createdWindows).toHaveLength(1);
    expect(mocks.createdWindows[0].options).toMatchObject({ width: 900, height: 700, x: 50, y: 70, center: false });
    expect(String(mocks.createdWindows[0].options.url)).toContain("panel=chart");
    expect(String(mocks.createdWindows[0].options.url)).toContain("symbol=AAPL-STK");
  });
});

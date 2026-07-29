import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { usePriceAlerts } from "./usePriceAlerts";
import type { Quote } from "../types";

function quote(key: string, last: number): Record<string, Quote> {
  return { [key]: { key, symbol: key, last } };
}

describe("usePriceAlerts", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts with no alerts", () => {
    const { result } = renderHook(() => usePriceAlerts({}));
    expect(result.current.alerts).toEqual([]);
  });

  it("adds an alert", () => {
    const { result } = renderHook(() => usePriceAlerts({}));
    act(() => {
      result.current.addAlert("STK|AAPL", "AAPL", "ABOVE", 200);
    });
    expect(result.current.alerts).toHaveLength(1);
    expect(result.current.alerts[0]).toMatchObject({ key: "STK|AAPL", condition: "ABOVE", price: 200, triggered: false });
  });

  it("removes an alert by id", () => {
    const { result } = renderHook(() => usePriceAlerts({}));
    act(() => {
      result.current.addAlert("STK|AAPL", "AAPL", "ABOVE", 200);
    });
    const id = result.current.alerts[0].id;
    act(() => {
      result.current.removeAlert(id);
    });
    expect(result.current.alerts).toEqual([]);
  });

  it("triggers an ABOVE alert once the price crosses at or above the target", () => {
    let quotes: Record<string, Quote> = {};
    const { result, rerender } = renderHook(() => usePriceAlerts(quotes));
    act(() => {
      result.current.addAlert("STK|AAPL", "AAPL", "ABOVE", 200);
    });

    quotes = quote("STK|AAPL", 199);
    rerender();
    expect(result.current.alerts[0].triggered).toBe(false);

    quotes = quote("STK|AAPL", 200);
    rerender();
    expect(result.current.alerts[0].triggered).toBe(true);
  });

  it("triggers a BELOW alert once the price crosses at or below the target", () => {
    let quotes: Record<string, Quote> = {};
    const { result, rerender } = renderHook(() => usePriceAlerts(quotes));
    act(() => {
      result.current.addAlert("STK|AAPL", "AAPL", "BELOW", 100);
    });

    quotes = quote("STK|AAPL", 101);
    rerender();
    expect(result.current.alerts[0].triggered).toBe(false);

    quotes = quote("STK|AAPL", 100);
    rerender();
    expect(result.current.alerts[0].triggered).toBe(true);
  });

  it("does not un-trigger an alert once it has fired", () => {
    let quotes: Record<string, Quote> = {};
    const { result, rerender } = renderHook(() => usePriceAlerts(quotes));
    act(() => {
      result.current.addAlert("STK|AAPL", "AAPL", "ABOVE", 200);
    });

    quotes = quote("STK|AAPL", 200);
    rerender();
    expect(result.current.alerts[0].triggered).toBe(true);

    quotes = quote("STK|AAPL", 50);
    rerender();
    expect(result.current.alerts[0].triggered).toBe(true);
  });
});

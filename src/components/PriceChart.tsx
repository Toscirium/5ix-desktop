import { CandlestickSeries, ColorType, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import type { Theme } from "../hooks/useTheme";
import type { Bar, BarSizeOption, ContractSpec } from "../types";

interface PriceChartProps {
  label: string | null;
  spec: ContractSpec | null;
  connected: boolean;
  theme: Theme;
  fetchHistoricalBars: (spec: ContractSpec, barSize: BarSizeOption, durationDays: number) => Promise<Bar[]>;
}

const BAR_SIZES: { label: string; value: BarSizeOption; durationDays: number }[] = [
  { label: "1m", value: "1min", durationDays: 1 },
  { label: "5m", value: "5min", durationDays: 2 },
  { label: "15m", value: "15min", durationDays: 5 },
  { label: "1h", value: "1hour", durationDays: 20 },
  { label: "1D", value: "1day", durationDays: 365 },
];

const CHART_COLORS: Record<Theme, { background: string; text: string; grid: string; border: string; up: string; down: string }> = {
  dark: {
    background: "#0b0e14",
    text: "#c7ccd6",
    grid: "#1a1f2b",
    border: "#262b38",
    up: "#3fb68b",
    down: "#e5484d",
  },
  light: {
    background: "#ffffff",
    text: "#3a3f4b",
    grid: "#eef0f4",
    border: "#dde1e8",
    up: "#16825a",
    down: "#c9333d",
  },
};

export function PriceChart({ label, spec, connected, theme, fetchHistoricalBars }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [barSize, setBarSize] = useState<BarSizeOption>("5min");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const colors = CHART_COLORS[theme];
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: colors.background }, textColor: colors.text },
      grid: { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: colors.border },
      rightPriceScale: { borderColor: colors.border },
      crosshair: { mode: 0 },
      autoSize: true,
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: colors.up,
      downColor: colors.down,
      borderVisible: false,
      wickUpColor: colors.up,
      wickDownColor: colors.down,
    });
    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // Created once; theme updates are applied in the effect below via applyOptions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!chartRef.current || !seriesRef.current) return;
    const colors = CHART_COLORS[theme];
    chartRef.current.applyOptions({
      layout: { background: { type: ColorType.Solid, color: colors.background }, textColor: colors.text },
      grid: { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } },
      timeScale: { borderColor: colors.border },
      rightPriceScale: { borderColor: colors.border },
    });
    seriesRef.current.applyOptions({
      upColor: colors.up,
      downColor: colors.down,
      wickUpColor: colors.up,
      wickDownColor: colors.down,
    });
  }, [theme]);

  useEffect(() => {
    if (!spec || !connected || !seriesRef.current) return;
    const config = BAR_SIZES.find((b) => b.value === barSize) ?? BAR_SIZES[1];
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchHistoricalBars(spec, config.value, config.durationDays)
      .then((bars) => {
        if (cancelled || !seriesRef.current) return;
        seriesRef.current.setData(
          bars.map((b) => ({
            time: b.time as UTCTimestamp,
            open: b.open,
            high: b.high,
            low: b.low,
            close: b.close,
          })),
        );
        chartRef.current?.timeScale().fitContent();
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [spec, barSize, connected, fetchHistoricalBars]);

  return (
    <div className="panel chart-panel">
      <div className="panel-header">
        <span>{label ? `Chart — ${label}` : "Chart"}</span>
        <div className="bar-size-picker">
          {BAR_SIZES.map((b) => (
            <button
              key={b.value}
              className={b.value === barSize ? "chip chip-active" : "chip"}
              onClick={() => setBarSize(b.value)}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
      {!spec && <div className="empty-state">Select a symbol from the watchlist</div>}
      {error && <div className="error-banner">{error}</div>}
      {loading && <div className="loading-banner">Loading bars…</div>}
      <div ref={containerRef} className="chart-container" />
    </div>
  );
}

export interface ConnectionStatus {
  connected: boolean;
  serverVersion?: number | null;
  error?: string | null;
  accounts?: string[];
}

export type ActivityLevel = "info" | "success" | "error";

export interface ActivityEntry {
  id: number;
  time: number;
  level: ActivityLevel;
  message: string;
}

export type AssetType = "STOCK" | "OPTION" | "FUTURE" | "FOREX" | "CRYPTO";
export type OptionRight = "CALL" | "PUT";

export interface ContractSpec {
  assetType: AssetType;
  symbol: string;
  right?: OptionRight;
  strike?: number;
  expiry?: string; // YYYY-MM-DD
  contractMonth?: string; // YYYY-MM, futures only; omit for front-month
  quoteCurrency?: string; // forex only
}

export interface WatchlistItem {
  key: string;
  label: string;
  spec: ContractSpec;
}

export interface Quote {
  key: string;
  symbol: string;
  bid?: number | null;
  ask?: number | null;
  last?: number | null;
  close?: number | null;
  high?: number | null;
  low?: number | null;
  bidSize?: number | null;
  askSize?: number | null;
  lastSize?: number | null;
  volume?: number | null;
}

export interface Position {
  account: string;
  symbol: string;
  localSymbol: string;
  securityType: string;
  strike?: number | null;
  right?: string | null;
  expiry?: string | null;
  exchange: string;
  currency: string;
  position: number;
  averageCost: number;
}

export interface AccountValue {
  account: string;
  tag: string;
  value: string;
  currency: string;
}

export interface Pnl {
  dailyPnl: number;
  unrealizedPnl?: number | null;
  realizedPnl?: number | null;
}

export type OrderUpdateKind = "status" | "execution" | "commission";

export interface OrderUpdate {
  orderId: number;
  kind: OrderUpdateKind;
  status?: string | null;
  filled?: number | null;
  remaining?: number | null;
  avgFillPrice?: number | null;
  symbol?: string | null;
  side?: string | null;
  shares?: number | null;
  price?: number | null;
  commission?: number | null;
}

export interface Bar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type OrderSide = "BUY" | "SELL";
export type OrderType = "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT" | "TRAILING_STOP";
export type BarSizeOption = "1min" | "5min" | "15min" | "1hour" | "1day";

export type AlgoStrategy = "VWAP" | "TWAP";

export interface AlgoOptions {
  strategy: AlgoStrategy;
  startTime?: string;
  endTime?: string;
  maxPctVol?: number;
}

export interface OpenOrder {
  orderId: number;
  symbol: string;
  securityType: string;
  action: string;
  orderType: string;
  totalQuantity: number;
  limitPrice?: number | null;
  auxPrice?: number | null;
  status: string;
}

export interface NewsArticleHeadline {
  time: number;
  providerCode: string;
  articleId: string;
  headline: string;
}

export interface ScannerRow {
  rank: number;
  symbol: string;
  exchange: string;
  securityType: string;
  longName: string;
}

export interface SymbolMatch {
  symbol: string;
  securityType: string;
  primaryExchange: string;
  currency: string;
}

export interface OptionChainInfo {
  expirations: string[];
  strikes: number[];
  tradingClass: string;
  multiplier: string;
}

export interface OptionSnapshot {
  bid?: number | null;
  ask?: number | null;
  last?: number | null;
  delta?: number | null;
  gamma?: number | null;
  theta?: number | null;
  vega?: number | null;
  impliedVol?: number | null;
}

export const SCAN_CODES: { value: string; label: string }[] = [
  { value: "TOP_PERC_GAIN", label: "Top % Gainers" },
  { value: "TOP_PERC_LOSE", label: "Top % Losers" },
  { value: "MOST_ACTIVE", label: "Most Active" },
  { value: "HOT_BY_VOLUME", label: "Hot by Volume" },
  { value: "TOP_OPEN_PERC_GAIN", label: "Top Open Gainers" },
  { value: "HIGH_OPT_IMP_VOLAT", label: "High Option Implied Vol" },
];

export function orderTypeFromIbkr(orderType: string): OrderType {
  switch (orderType.toUpperCase()) {
    case "LMT":
      return "LIMIT";
    case "STP":
      return "STOP";
    case "STP LMT":
      return "STOP_LIMIT";
    case "TRAIL":
      return "TRAILING_STOP";
    default:
      return "MARKET";
  }
}

export function contractKey(spec: ContractSpec): string {
  switch (spec.assetType) {
    case "OPTION":
      return `OPT|${spec.symbol}|${spec.expiry}|${spec.strike}|${spec.right}`;
    case "FUTURE":
      return `FUT|${spec.symbol}|${spec.contractMonth ?? "FRONT"}`;
    case "FOREX":
      return `FX|${spec.symbol}|${spec.quoteCurrency}`;
    case "CRYPTO":
      return `CRYPTO|${spec.symbol}`;
    default:
      return `STK|${spec.symbol}`;
  }
}

export function contractLabel(spec: ContractSpec): string {
  switch (spec.assetType) {
    case "OPTION":
      return `${spec.symbol} ${spec.expiry} ${spec.strike}${spec.right === "PUT" ? "P" : "C"}`;
    case "FUTURE":
      return `${spec.symbol} ${spec.contractMonth ?? "Front"}`;
    case "FOREX":
      return `${spec.symbol}.${spec.quoteCurrency}`;
    case "CRYPTO":
      return `${spec.symbol} (Crypto)`;
    default:
      return spec.symbol;
  }
}

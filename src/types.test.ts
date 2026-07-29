import { describe, expect, it } from "vitest";
import { contractKey, contractLabel, orderTypeFromIbkr } from "./types";
import type { ContractSpec } from "./types";

describe("contractKey", () => {
  it("builds a stock key", () => {
    const spec: ContractSpec = { assetType: "STOCK", symbol: "AAPL" };
    expect(contractKey(spec)).toBe("STK|AAPL");
  });

  it("builds an option key", () => {
    const spec: ContractSpec = {
      assetType: "OPTION",
      symbol: "AAPL",
      expiry: "2024-12-20",
      strike: 150,
      right: "CALL",
    };
    expect(contractKey(spec)).toBe("OPT|AAPL|2024-12-20|150|CALL");
  });

  it("builds a future key defaulting to FRONT when no contract month is set", () => {
    const spec: ContractSpec = { assetType: "FUTURE", symbol: "ES" };
    expect(contractKey(spec)).toBe("FUT|ES|FRONT");
  });

  it("builds a future key with an explicit contract month", () => {
    const spec: ContractSpec = { assetType: "FUTURE", symbol: "ES", contractMonth: "2024-12" };
    expect(contractKey(spec)).toBe("FUT|ES|2024-12");
  });

  it("builds a forex key", () => {
    const spec: ContractSpec = { assetType: "FOREX", symbol: "EUR", quoteCurrency: "USD" };
    expect(contractKey(spec)).toBe("FX|EUR|USD");
  });

  it("builds a crypto key", () => {
    const spec: ContractSpec = { assetType: "CRYPTO", symbol: "BTC" };
    expect(contractKey(spec)).toBe("CRYPTO|BTC");
  });
});

describe("contractLabel", () => {
  it("labels a stock by symbol alone", () => {
    expect(contractLabel({ assetType: "STOCK", symbol: "AAPL" })).toBe("AAPL");
  });

  it("labels a call option with a C suffix", () => {
    const spec: ContractSpec = { assetType: "OPTION", symbol: "AAPL", expiry: "2024-12-20", strike: 150, right: "CALL" };
    expect(contractLabel(spec)).toBe("AAPL 2024-12-20 150C");
  });

  it("labels a put option with a P suffix", () => {
    const spec: ContractSpec = { assetType: "OPTION", symbol: "SPY", expiry: "2024-06-21", strike: 450, right: "PUT" };
    expect(contractLabel(spec)).toBe("SPY 2024-06-21 450P");
  });

  it("labels a future with its contract month or Front", () => {
    expect(contractLabel({ assetType: "FUTURE", symbol: "ES" })).toBe("ES Front");
    expect(contractLabel({ assetType: "FUTURE", symbol: "ES", contractMonth: "2024-12" })).toBe("ES 2024-12");
  });

  it("labels forex as SYMBOL.CURRENCY", () => {
    expect(contractLabel({ assetType: "FOREX", symbol: "EUR", quoteCurrency: "USD" })).toBe("EUR.USD");
  });

  it("labels crypto with a suffix", () => {
    expect(contractLabel({ assetType: "CRYPTO", symbol: "BTC" })).toBe("BTC (Crypto)");
  });
});

describe("orderTypeFromIbkr", () => {
  it.each([
    ["LMT", "LIMIT"],
    ["lmt", "LIMIT"],
    ["STP", "STOP"],
    ["STP LMT", "STOP_LIMIT"],
    ["TRAIL", "TRAILING_STOP"],
    ["MKT", "MARKET"],
    ["anything-else", "MARKET"],
  ] as const)("maps %s to %s", (input, expected) => {
    expect(orderTypeFromIbkr(input)).toBe(expected);
  });
});

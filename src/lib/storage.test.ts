import { beforeEach, describe, expect, it } from "vitest";
import { loadJSON, saveJSON } from "./storage";

describe("storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns the fallback when nothing is stored", () => {
    expect(loadJSON("missing-key", { a: 1 })).toEqual({ a: 1 });
  });

  it("round-trips a saved value", () => {
    saveJSON("key", { a: 1, b: [1, 2, 3] });
    expect(loadJSON("key", null)).toEqual({ a: 1, b: [1, 2, 3] });
  });

  it("falls back on corrupted JSON instead of throwing", () => {
    localStorage.setItem("key", "{not json");
    expect(loadJSON("key", "fallback")).toBe("fallback");
  });

  it("saveJSON does not throw for values that fail to serialize", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => saveJSON("key", circular)).not.toThrow();
  });
});

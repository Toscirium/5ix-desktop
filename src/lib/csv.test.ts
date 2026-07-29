import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("joins headers and rows with commas and CRLF", () => {
    const csv = toCsv(["A", "B"], [
      [1, 2],
      [3, 4],
    ]);
    expect(csv).toBe("A,B\r\n1,2\r\n3,4");
  });

  it("renders null and undefined cells as empty strings", () => {
    expect(toCsv(["A"], [[null], [undefined]])).toBe("A\r\n\r\n");
  });

  it("quotes and escapes cells containing commas, quotes, or newlines", () => {
    const csv = toCsv(["Note"], [['has "quotes"'], ["has,comma"], ["has\nnewline"]]);
    expect(csv).toBe('Note\r\n"has ""quotes"""\r\n"has,comma"\r\n"has\nnewline"');
  });
});

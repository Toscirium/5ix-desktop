import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrderTicket } from "./OrderTicket";
import { DEFAULT_SETTINGS } from "../lib/settings";
import type { ContractSpec } from "../types";

const spec: ContractSpec = { assetType: "STOCK", symbol: "AAPL" };
const BRACKET_CHECKBOX_NAME = "Attach bracket (take-profit / stop-loss)";

function setup() {
  const onSubmit = vi.fn().mockResolvedValue(1);
  const onSubmitBracket = vi.fn().mockResolvedValue({ parentId: 1, takeProfitId: 2, stopLossId: 3 });
  render(
    <OrderTicket
      label="AAPL"
      spec={spec}
      connected
      settings={DEFAULT_SETTINGS}
      onSubmit={onSubmit}
      onSubmitBracket={onSubmitBracket}
      orderLog={[]}
    />,
  );
  return { onSubmit, onSubmitBracket };
}

describe("OrderTicket bracket orders", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("hides take-profit/stop-loss fields until the bracket checkbox is checked", () => {
    setup();
    expect(screen.queryByLabelText("Take Profit Price")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: BRACKET_CHECKBOX_NAME }));
    expect(screen.getByLabelText("Take Profit Price")).toBeInTheDocument();
    expect(screen.getByLabelText("Stop Loss Price")).toBeInTheDocument();
  });

  it("disables submit until take-profit and stop-loss are filled", () => {
    setup();
    fireEvent.click(screen.getByRole("checkbox", { name: BRACKET_CHECKBOX_NAME }));
    expect(screen.getByRole("button", { name: /Buy AAPL/ })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Take Profit Price"), { target: { value: "160" } });
    expect(screen.getByRole("button", { name: /Buy AAPL/ })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Stop Loss Price"), { target: { value: "140" } });
    expect(screen.getByRole("button", { name: /Buy AAPL/ })).not.toBeDisabled();
  });

  it("submits a bracket order with the entered prices on confirm", async () => {
    const { onSubmitBracket } = setup();
    fireEvent.click(screen.getByRole("checkbox", { name: BRACKET_CHECKBOX_NAME }));
    fireEvent.change(screen.getByLabelText("Take Profit Price"), { target: { value: "160" } });
    fireEvent.change(screen.getByLabelText("Stop Loss Price"), { target: { value: "140" } });

    fireEvent.click(screen.getByRole("button", { name: /Buy AAPL/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Confirm Buy/ }));

    expect(onSubmitBracket).toHaveBeenCalledWith(spec, "BUY", DEFAULT_SETTINGS.defaultQuantity, undefined, 160, 140);
  });

  it("disables the algo strategy select while a bracket is attached", () => {
    setup();
    fireEvent.click(screen.getByRole("checkbox", { name: BRACKET_CHECKBOX_NAME }));
    expect(screen.getByLabelText("Algo Strategy")).toBeDisabled();
  });

  it("disables the bracket checkbox while an algo strategy is selected", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Algo Strategy"), { target: { value: "VWAP" } });
    expect(screen.getByRole("checkbox", { name: BRACKET_CHECKBOX_NAME })).toBeDisabled();
  });
});

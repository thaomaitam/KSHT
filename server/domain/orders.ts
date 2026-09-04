import { fail } from "./errors.ts";
import { addVnd, assertVnd, subtractVnd, type Vnd } from "./money.ts";
import { lineAmount, type QuantityFactors } from "./quantity.ts";
import { assertTransition, canCancelStatus, type OrderStatus } from "./lifecycle.ts";

export interface OrderLineInput extends QuantityFactors {
  unitPrice: Vnd;
  costPrice: Vnd;
}

export interface OrderTotals {
  lineSubtotal: Vnd;
  cogs: Vnd;
  discount: Vnd;
  shippingFee: Vnd;
  total: Vnd;
}

export const lineSaleSubtotal = (line: OrderLineInput): Vnd =>
  lineAmount(line.unitPrice, line, "sale");

export const lineCogs = (line: OrderLineInput): Vnd =>
  lineAmount(line.costPrice, line, "cogs");

export const computeOrderTotals = (
  lines: OrderLineInput[],
  discount: Vnd = 0,
  shippingFee: Vnd = 0,
): OrderTotals => {
  if (!Array.isArray(lines) || lines.length < 1) {
    fail("VALIDATION_ERROR", "An order requires at least one line");
  }
  const lineSubtotal = addVnd(...lines.map(lineSaleSubtotal));
  const cogs = addVnd(...lines.map(lineCogs));
  assertVnd(discount, "discount");
  assertVnd(shippingFee, "shippingFee");
  if (discount > lineSubtotal) {
    fail("VALIDATION_ERROR", "discount cannot exceed line subtotal");
  }
  const total = addVnd(subtractVnd(lineSubtotal, discount, "discount"), shippingFee);
  return { lineSubtotal, cogs, discount, shippingFee, total };
};

export const assertDraftEditable = (status: OrderStatus): void => {
  if (status !== "draft") {
    fail("INVALID_TRANSITION", "Only draft orders can be edited");
  }
};

export const assertCanDiscardDraft = (status: OrderStatus, netCollected: Vnd): void => {
  if (status !== "draft") {
    fail("INVALID_TRANSITION", "Only draft orders can be discarded");
  }
  if (netCollected !== 0) {
    fail("INVALID_TRANSITION", "A draft with collected payment cannot be discarded");
  }
};

export const assertCanCancel = (status: OrderStatus, netCollected: Vnd, reason: string): void => {
  if (!reason.trim()) {
    fail("VALIDATION_ERROR", "Cancellation requires a reason");
  }
  if (!canCancelStatus(status)) {
    fail("INVALID_TRANSITION", `Cannot cancel an order in status ${status}`);
  }
  if (netCollected !== 0) {
    fail("INVALID_TRANSITION", "Cannot cancel while net collected payment remains", {
      nextAction: "Record a refund or reverse the erroneous payment, then retry cancellation.",
    });
  }
};

export const transitionOrder = (from: OrderStatus, to: OrderStatus): OrderStatus => {
  assertTransition(from, to);
  return to;
};

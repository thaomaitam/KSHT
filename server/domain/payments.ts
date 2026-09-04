import { fail } from "./errors.ts";
import { addVnd, assertVnd, subtractVnd, type Vnd } from "./money.ts";
import { isActiveSaleStatus, type OrderStatus } from "./lifecycle.ts";

export interface PaymentBalance {
  amount: Vnd;
  reversedAmount: Vnd;
  refundedAmount: Vnd;
}

export const remainingConsumable = (payment: PaymentBalance): Vnd => {
  assertVnd(payment.amount, "amount");
  assertVnd(payment.reversedAmount, "reversedAmount");
  assertVnd(payment.refundedAmount, "refundedAmount");
  const consumed = addVnd(payment.reversedAmount, payment.refundedAmount);
  if (consumed > payment.amount) {
    fail("VALIDATION_ERROR", "reversedAmount + refundedAmount cannot exceed payment amount");
  }
  return subtractVnd(payment.amount, consumed, "remaining");
};

export const applyConsumption = (
  payment: PaymentBalance,
  kind: "reversal" | "refund",
  consume: Vnd,
): PaymentBalance => {
  assertVnd(consume, kind);
  if (consume < 1) {
    fail("VALIDATION_ERROR", `${kind} amount must be at least 1`);
  }
  const remaining = remainingConsumable(payment);
  if (consume > remaining) {
    fail("VALIDATION_ERROR", `${kind} would double-consume the payment`);
  }
  if (kind === "reversal") {
    return { ...payment, reversedAmount: addVnd(payment.reversedAmount, consume) };
  }
  return { ...payment, refundedAmount: addVnd(payment.refundedAmount, consume) };
};

export const netCollected = (payments: PaymentBalance[]): Vnd =>
  payments.reduce((sum, payment) => addVnd(sum, remainingConsumable(payment)), 0);

export const outstandingForOrder = (orderTotal: Vnd, collected: Vnd, status: OrderStatus): Vnd => {
  assertVnd(orderTotal, "orderTotal");
  assertVnd(collected, "netCollected");
  if (status === "cancelled" || status === "discarded" || status === "draft") {
    return 0;
  }
  if (collected > orderTotal) {
    fail("VALIDATION_ERROR", "A payment may not make an order overpaid");
  }
  return subtractVnd(orderTotal, collected, "outstanding");
};

export const assertPaymentAllowed = (
  orderTotal: Vnd,
  currentNet: Vnd,
  incoming: Vnd,
  status: OrderStatus,
): void => {
  assertVnd(incoming, "payment");
  if (incoming < 1) {
    fail("VALIDATION_ERROR", "payment amount must be at least 1");
  }
  if (!isActiveSaleStatus(status) && status !== "draft") {
    fail("INVALID_TRANSITION", "Cannot record payment on a cancelled or discarded order");
  }
  if (addVnd(currentNet, incoming) > orderTotal) {
    fail("VALIDATION_ERROR", "A payment may not make an order overpaid");
  }
};

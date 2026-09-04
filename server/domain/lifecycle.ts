import { fail } from "./errors.ts";

export const ORDER_STATUSES = [
  "draft",
  "confirmed",
  "shipping",
  "completed",
  "cancelled",
  "discarded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const LEGAL: Record<OrderStatus, readonly OrderStatus[]> = {
  draft: ["confirmed", "discarded"],
  confirmed: ["shipping", "cancelled"],
  shipping: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  discarded: ["draft"],
};

export const assertTransition = (from: OrderStatus, to: OrderStatus): void => {
  if (!LEGAL[from]?.includes(to)) {
    fail("INVALID_TRANSITION", `Cannot transition order from ${from} to ${to}`, {
      nextAction: "Use a legal lifecycle action or clone a cancelled order into a new draft.",
    });
  }
};

export const isActiveSaleStatus = (status: OrderStatus): boolean =>
  status === "confirmed" || status === "shipping" || status === "completed";

export const canCancelStatus = (status: OrderStatus): boolean =>
  status === "confirmed" || status === "shipping";

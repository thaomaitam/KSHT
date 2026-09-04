import { addVnd, type Vnd } from "./money.ts";
import { isActiveSaleStatus, type OrderStatus } from "./lifecycle.ts";
import { netCollected, outstandingForOrder, type PaymentBalance } from "./payments.ts";
import { computeOrderTotals, type OrderLineInput } from "./orders.ts";

export interface ReportOrder {
  status: OrderStatus;
  confirmedAt?: string | null;
  discount: Vnd;
  shippingFee: Vnd;
  lines: OrderLineInput[];
  payments: PaymentBalance[];
}

export interface ReportTotals {
  confirmedSales: Vnd;
  grossReceipts: Vnd;
  refunds: Vnd;
  netReceipts: Vnd;
  receivables: Vnd;
  discounts: Vnd;
  shippingFees: Vnd;
  cogs: Vnd;
  profit: Vnd;
}

export const BUSINESS_TIMEZONE = "Asia/Ho_Chi_Minh";

export const summarizeOrders = (orders: ReportOrder[]): ReportTotals => {
  let confirmedSales = 0;
  let grossReceipts = 0;
  let refunds = 0;
  let receivables = 0;
  let discounts = 0;
  let shippingFees = 0;
  let cogs = 0;

  for (const order of orders) {
    const totals = computeOrderTotals(order.lines, order.discount, order.shippingFee);
    const collected = netCollected(order.payments);
    if (isActiveSaleStatus(order.status)) {
      confirmedSales = addVnd(confirmedSales, totals.total);
      discounts = addVnd(discounts, totals.discount);
      shippingFees = addVnd(shippingFees, totals.shippingFee);
      cogs = addVnd(cogs, totals.cogs);
      receivables = addVnd(receivables, outstandingForOrder(totals.total, collected, order.status));
    }
    for (const payment of order.payments) {
      const validGross = payment.amount - payment.reversedAmount;
      grossReceipts = addVnd(grossReceipts, validGross);
      refunds = addVnd(refunds, payment.refundedAmount);
    }
  }

  const netReceipts = grossReceipts - refunds;
  const profit = confirmedSales - cogs;
  return {
    confirmedSales,
    grossReceipts,
    refunds,
    netReceipts,
    receivables,
    discounts,
    shippingFees,
    cogs,
    profit,
  };
};

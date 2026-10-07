import { addVnd, subtractVnd, type Vnd } from "./money.ts";
import { isActiveSaleStatus, type OrderStatus } from "./lifecycle.ts";
import { netCollected, outstandingForOrder, type PaymentBalance } from "./payments.ts";
import { computeOrderTotals, type OrderLineInput } from "./orders.ts";

export interface ReportOrder {
  orderId?: string;
  status: OrderStatus;
  confirmedAt?: string | null;
  discount: Vnd;
  shippingFee: Vnd;
  lines: OrderLineInput[];
  payments: PaymentBalance[];
}

export type DataQualityFlagKind = "cogs_exceeds_sales";

export interface DataQualityFlag {
  kind: DataQualityFlagKind;
  orderId?: string;
  detail: string;
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
  dataQualityFlags: DataQualityFlag[];
}


export const summarizeOrders = (orders: ReportOrder[]): ReportTotals => {
  let confirmedSales = 0;
  let grossReceipts = 0;
  let refunds = 0;
  let receivables = 0;
  let discounts = 0;
  let shippingFees = 0;
  let cogs = 0;
  const dataQualityFlags: DataQualityFlag[] = [];

  for (const order of orders) {
    const totals = computeOrderTotals(order.lines, order.discount, order.shippingFee);
    const collected = netCollected(order.payments);
    if (isActiveSaleStatus(order.status)) {
      confirmedSales = addVnd(confirmedSales, totals.total);
      discounts = addVnd(discounts, totals.discount);
      shippingFees = addVnd(shippingFees, totals.shippingFee);
      cogs = addVnd(cogs, totals.cogs);
      receivables = addVnd(receivables, outstandingForOrder(totals.total, collected, order.status));
      if (totals.cogs > totals.total) {
        dataQualityFlags.push({
          kind: "cogs_exceeds_sales",
          orderId: order.orderId,
          detail: `cogs ${totals.cogs} exceeds order total ${totals.total}`,
        });
      }
    }
    for (const payment of order.payments) {
      const validGross = subtractVnd(payment.amount, payment.reversedAmount);
      grossReceipts = addVnd(grossReceipts, validGross);
      refunds = addVnd(refunds, payment.refundedAmount);
    }
  }

  // Historical data can be inconsistent (legacy imports, later cost corrections).
  // netCollected() above already guarantees aggregate refunds <= gross receipts,
  // but aggregate cogs can exceed confirmed sales: clamp instead of fail-closing
  // the whole report; dataQualityFlags pinpoints the exact records for review.
  const netReceipts = subtractVnd(grossReceipts, refunds);
  const profit = cogs > confirmedSales ? 0 : subtractVnd(confirmedSales, cogs);
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
    dataQualityFlags,
  };
};

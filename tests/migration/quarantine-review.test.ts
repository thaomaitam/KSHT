import assert from "node:assert/strict";
import test from "node:test";

import { buildQuarantineReview } from "../../workers/mcp/liveKvStore.ts";

const item = (id: string) => ({
  id,
  productId: "p_live",
  name: "Cọ live",
  unit: "Cây",
  quantity: 1,
  unitPrice: 5000,
  total: 5000,
});

const shop = () => ({
  customers: [
    { id: "c_linked", name: "Khách A", phone: "0901000001" },
    { id: "c_accent", name: "Nguyễn Văn A", phone: "0901000002" },
    { id: "c_other", name: "Other Person", phone: "0901000003" },
    { id: "c_dup_a", name: "Dup A", phone: "0901222333" },
    { id: "c_dup_b", name: "Dup B", phone: "0901222333" },
  ],
  orders: [
    {
      id: "o_linked",
      customerId: "c_linked",
      customerName: "Khách A",
      phone: "0901000001",
      items: [item("i_linked")],
      total: 5000,
    },
    {
      id: "o_diacritic",
      customerName: "Nguyen Van A",
      phone: "0901000002",
      items: [item("i_diacritic")],
      total: 5000,
    },
    {
      id: "o_empty_name",
      customerName: "",
      phone: "0901000003",
      items: [item("i_empty")],
      total: 5000,
    },
    {
      id: "o_other_name",
      customerName: "Totally Different",
      phone: "0901000003",
      items: [item("i_other")],
      total: 5000,
    },
    {
      id: "o_dup_match_one",
      customerName: "Dup A",
      phone: "0901222333",
      items: [item("i_dup_one")],
      total: 5000,
    },
    {
      id: "o_dup_match_none",
      customerName: "Nobody",
      phone: "0901222333",
      items: [item("i_dup_none")],
      total: 5000,
    },
    {
      id: "o_no_candidate",
      customerName: "Walk In",
      phone: "0999999999",
      items: [item("i_none")],
      total: 5000,
    },
    {
      id: "o_no_candidate_blank",
      phone: "0888888888",
      items: [item("i_none_blank")],
      total: 5000,
    },
    {
      id: "o_missing_phone",
      customerId: "stale_customer",
      customerName: "No Phone",
      items: [item("i_missing")],
      total: 5000,
    },
    {
      id: "o_missing_phone_blank",
      items: [item("i_missing_blank")],
      total: 5000,
    },
    {
      id: "o_unexplained_overlap",
      customerName: "No Phone Money",
      items: [item("i_money_overlap")],
      total: 8000,
      debt: 0,
    },
    {
      id: "o_unexplained_linked",
      customerId: "c_linked",
      customerName: "Khách A",
      phone: "0901000001",
      items: [item("i_money_linked")],
      total: 4000,
      debt: 2500,
    },
  ],
});

const leakNeedles = [
  "c_linked",
  "c_accent",
  "stale_customer",
  "o_diacritic",
  "o_unexplained_linked",
  "Khách A",
  "Nguyễn Văn A",
  "Nguyen Van A",
  "Totally Different",
  "Walk In",
  "No Phone",
  "0901000001",
  "0901222333",
  "0999999999",
  "Dup A",
  "Nobody",
];

test("buildQuarantineReview reports PII-safe remaining-class aggregates", () => {
  const review = buildQuarantineReview(shop());
  assert.deepEqual(review.customerLinks.uniquePhoneNameDisagreement, {
    count: 3,
    emptyOrderName: 1,
    diacriticOrWhitespaceOnly: 1,
    other: 1,
  });
  assert.deepEqual(review.customerLinks.duplicatePhoneAmbiguity, {
    count: 2,
    groups: 1,
    orderNameMatchesExactlyOneCustomer: 1,
    orderNameMatchesNone: 1,
  });
  assert.deepEqual(review.customerLinks.noCandidate, {
    count: 2,
    hasName: 1,
    missingName: 1,
  });
  assert.deepEqual(review.customerLinks.missingPhone, {
    count: 3,
    hasName: 2,
    missingName: 1,
    hasNonEmptyCustomerId: 1,
  });
  assert.deepEqual(review.money.unexplainedTotalMismatch, {
    count: 2,
    debtZero: 1,
    debtPositive: 1,
    totalEqualsComputed: 0,
    totalGreaterThanComputed: 1,
    totalLessThanComputed: 1,
    alsoCustomerLinkQuarantine: 1,
  });
  const serialized = JSON.stringify(review);
  for (const needle of leakNeedles) {
    assert.equal(serialized.includes(needle), false, `review leaked ${needle}`);
  }
});

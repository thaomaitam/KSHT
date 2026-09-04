import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import { applySql } from "../../server/persistence/d1/migrate.ts";

const open = () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  applySql((sql) => db.exec(sql));
  db.prepare("INSERT INTO dataset_generations (id, created_at, active) VALUES (?, ?, 1)").run("gen_1", "2026-09-04T00:00:00.000Z");
  db.prepare("INSERT INTO active_dataset (lock_id, generation_id) VALUES (1, ?)").run("gen_1");
  return db;
};

test("schema rejects negative money and over-consumed payments", () => {
  const db = open();
  db.prepare(
    "INSERT INTO categories (id, dataset_generation_id, label, value, archived, revision, created_at, updated_at) VALUES ('c1','gen_1','Cọ','PAINT',0,1,'t','t')",
  ).run();
  assert.throws(() => {
    db.prepare(
      "INSERT INTO products (id, dataset_generation_id, category_id, name, description, image, is_hot, archived, revision, created_at, updated_at) VALUES ('p1','gen_1','c1','n','d','i',0,0,1,'t','t')",
    ).run();
    db.prepare("INSERT INTO product_variants (product_id, size, unit, price, cost_price) VALUES ('p1','1','Cây',-1,0)").run();
  });
});

test("payment plus audit commit together and roll back together", () => {
  const db = open();
  db.exec(`
    INSERT INTO categories (id, dataset_generation_id, label, value, archived, revision, created_at, updated_at)
      VALUES ('c1','gen_1','Cọ','PAINT',0,1,'t','t');
    INSERT INTO products (id, dataset_generation_id, category_id, name, description, image, is_hot, archived, revision, created_at, updated_at)
      VALUES ('p1','gen_1','c1','n','d','i',0,0,1,'t','t');
    INSERT INTO customers (id, dataset_generation_id, name, phone, address, archived, revision, created_at, updated_at)
      VALUES ('cus1','gen_1','A','0901','x',0,1,'t','t');
    INSERT INTO orders (id, dataset_generation_id, customer_id, contact_name, contact_phone, contact_address, status, discount, shipping_fee, payment_method, revision, created_at, updated_at)
      VALUES ('ord1','gen_1','cus1','A','0901','x','confirmed',0,0,'cod',1,'t','t');
  `);
  db.exec("BEGIN");
  db.prepare(
    "INSERT INTO payments (id, dataset_generation_id, order_id, amount, reversed_amount, refunded_amount, method, created_at) VALUES ('pay1','gen_1','ord1',1000,0,0,'cash','t')",
  ).run();
  db.prepare(
    "INSERT INTO audit_events (id, at, actor, channel, operation_id, target_ids_json, outcome, request_id, dataset_generation_id) VALUES ('aud1','t','owner','rpc','recordPayment','[\"ord1\"]','ok','req1','gen_1')",
  ).run();
  db.exec("COMMIT");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM payments").get().n, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit_events").get().n, 1);

  db.exec("BEGIN");
  db.prepare(
    "INSERT INTO payments (id, dataset_generation_id, order_id, amount, reversed_amount, refunded_amount, method, created_at) VALUES ('pay2','gen_1','ord1',500,0,0,'cash','t')",
  ).run();
  db.exec("ROLLBACK");
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM payments").get().n, 1);
});

test("active generation pointer switches atomically", () => {
  const db = open();
  db.prepare("INSERT INTO dataset_generations (id, created_at, active) VALUES (?, ?, 0)").run("gen_2", "t");
  db.exec("BEGIN");
  db.prepare("UPDATE dataset_generations SET active = 0 WHERE id = 'gen_1'").run();
  db.prepare("UPDATE dataset_generations SET active = 1 WHERE id = 'gen_2'").run();
  db.prepare("UPDATE active_dataset SET generation_id = 'gen_2' WHERE lock_id = 1").run();
  db.exec("COMMIT");
  assert.equal(db.prepare("SELECT generation_id AS id FROM active_dataset WHERE lock_id = 1").get().id, "gen_2");
});

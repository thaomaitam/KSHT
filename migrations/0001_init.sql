CREATE TABLE dataset_generations (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1))
);

CREATE TABLE active_dataset (
  lock_id INTEGER PRIMARY KEY CHECK (lock_id = 1),
  generation_id TEXT NOT NULL REFERENCES dataset_generations(id)
);

CREATE TABLE maintenance_leases (
  id TEXT PRIMARY KEY,
  holder TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  dataset_generation_id TEXT NOT NULL REFERENCES dataset_generations(id),
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  dataset_generation_id TEXT NOT NULL REFERENCES dataset_generations(id),
  category_id TEXT NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  image TEXT NOT NULL,
  is_hot INTEGER NOT NULL DEFAULT 0 CHECK (is_hot IN (0, 1)),
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE product_variants (
  product_id TEXT NOT NULL REFERENCES products(id),
  size TEXT NOT NULL,
  unit TEXT NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  cost_price INTEGER NOT NULL CHECK (cost_price >= 0),
  PRIMARY KEY (product_id, size, unit)
);

CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  dataset_generation_id TEXT NOT NULL REFERENCES dataset_generations(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  merged_into_id TEXT REFERENCES customers(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE customer_merge_events (
  id TEXT PRIMARY KEY,
  dataset_generation_id TEXT NOT NULL REFERENCES dataset_generations(id),
  canonical_customer_id TEXT NOT NULL REFERENCES customers(id),
  source_customer_id TEXT NOT NULL REFERENCES customers(id),
  reversed INTEGER NOT NULL DEFAULT 0 CHECK (reversed IN (0, 1)),
  created_at TEXT NOT NULL
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  dataset_generation_id TEXT NOT NULL REFERENCES dataset_generations(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_address TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'confirmed', 'shipping', 'completed', 'cancelled', 'discarded')),
  discount INTEGER NOT NULL CHECK (discount >= 0),
  shipping_fee INTEGER NOT NULL CHECK (shipping_fee >= 0),
  note TEXT NOT NULL DEFAULT '',
  shop_template_id TEXT,
  seller_snapshot_json TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cod', 'banking')),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  discarded INTEGER NOT NULL DEFAULT 0 CHECK (discarded IN (0, 1)),
  cancel_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE order_lines (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  product_id TEXT,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 1),
  so_cuon INTEGER,
  so_ki INTEGER,
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  cost_price INTEGER NOT NULL CHECK (cost_price >= 0),
  is_manual INTEGER NOT NULL DEFAULT 0 CHECK (is_manual IN (0, 1))
);

CREATE TABLE order_status_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  at TEXT NOT NULL
);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  dataset_generation_id TEXT NOT NULL REFERENCES dataset_generations(id),
  order_id TEXT NOT NULL REFERENCES orders(id),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  reversed_amount INTEGER NOT NULL DEFAULT 0 CHECK (reversed_amount >= 0),
  refunded_amount INTEGER NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
  method TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  CHECK (reversed_amount + refunded_amount <= amount)
);

CREATE TABLE payment_reversals (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  amount INTEGER NOT NULL CHECK (amount >= 1),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE payment_refunds (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id),
  amount INTEGER NOT NULL CHECK (amount >= 1),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE cash_transactions (
  id TEXT PRIMARY KEY,
  dataset_generation_id TEXT NOT NULL REFERENCES dataset_generations(id),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount INTEGER NOT NULL CHECK (amount >= 0),
  reversed_amount INTEGER NOT NULL DEFAULT 0 CHECK (reversed_amount >= 0),
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (reversed_amount <= amount)
);

CREATE TABLE cash_transaction_reversals (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES cash_transactions(id),
  amount INTEGER NOT NULL CHECK (amount >= 1),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1)
);

CREATE TABLE shop_templates (
  id TEXT PRIMARY KEY,
  dataset_generation_id TEXT NOT NULL REFERENCES dataset_generations(id),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE principals (
  id TEXT PRIMARY KEY,
  github_user_id TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE TABLE principal_scope_grants (
  principal_id TEXT NOT NULL REFERENCES principals(id),
  scope TEXT NOT NULL,
  PRIMARY KEY (principal_id, scope)
);

CREATE TABLE idempotency_records (
  principal_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (principal_id, operation_id, idempotency_key)
);

CREATE TABLE confirmation_intents (
  token TEXT PRIMARY KEY,
  principal_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  input_json TEXT NOT NULL
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  channel TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  target_ids_json TEXT NOT NULL,
  outcome TEXT NOT NULL,
  request_id TEXT NOT NULL,
  dataset_generation_id TEXT NOT NULL
);

CREATE TABLE projection_outbox (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  published_at TEXT,
  kind TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE backup_manifests (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  byte_length INTEGER NOT NULL DEFAULT 0,
  checksum_sha256 TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX idx_one_default_template
  ON shop_templates(dataset_generation_id)
  WHERE is_default = 1 AND archived = 0;

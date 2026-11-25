-- Products, orders, their items and an audit log. Money is in paise (integers).

CREATE TABLE products (
  id          TEXT PRIMARY KEY,                -- the variant id, e.g. 'herbal-black-salt-1kg'
  slug        TEXT NOT NULL,                   -- the product's handle (its page: /product/<slug>)
  name        TEXT NOT NULL,
  format      TEXT NOT NULL CHECK (format IN ('jar', 'pouch')),
  price_paise INTEGER CHECK (price_paise IS NULL OR price_paise > 0),
  active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE TABLE orders (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  public_ref          TEXT NOT NULL UNIQUE,    -- shown to the customer, e.g. 'PY-24A7K'
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN
                        ('pending', 'paid', 'cod_confirmed', 'packed', 'shipped', 'delivered', 'cancelled')),
  payment_method      TEXT NOT NULL CHECK (payment_method IN ('online', 'cod')),
  subtotal_paise      INTEGER NOT NULL CHECK (subtotal_paise >= 0),
  shipping_paise      INTEGER NOT NULL CHECK (shipping_paise >= 0),
  total_paise         INTEGER NOT NULL CHECK (total_paise >= 0),
  customer_name       TEXT NOT NULL,
  customer_phone      TEXT NOT NULL,
  customer_email      TEXT,
  address_line1       TEXT NOT NULL,
  address_line2       TEXT,
  city                TEXT NOT NULL,
  state               TEXT NOT NULL,
  pincode             TEXT NOT NULL CHECK (length(pincode) = 6),
  razorpay_order_id   TEXT UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX orders_status ON orders (status, created_at);

CREATE TABLE order_items (
  order_id         INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id       TEXT NOT NULL REFERENCES products (id),
  qty              INTEGER NOT NULL CHECK (qty > 0),
  unit_price_paise INTEGER NOT NULL CHECK (unit_price_paise > 0),
  PRIMARY KEY (order_id, product_id)
);

CREATE TABLE events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER REFERENCES orders (id) ON DELETE CASCADE,
  type       TEXT NOT NULL,                    -- e.g. 'order.created', 'payment.captured'
  payload    TEXT,                             -- JSON
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX events_order ON events (order_id, created_at);

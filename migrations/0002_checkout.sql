-- Checkout: the customer's access token, the client's idempotency key, tracking, webhook
-- de-duplication and a per-IP rate limit.

ALTER TABLE orders ADD COLUMN access_token TEXT;
ALTER TABLE orders ADD COLUMN idempotency_key TEXT;
ALTER TABLE orders ADD COLUMN tracking_number TEXT;
CREATE UNIQUE INDEX orders_idempotency ON orders (idempotency_key);

ALTER TABLE events ADD COLUMN source_id TEXT;   -- e.g. Razorpay's x-razorpay-event-id
CREATE UNIQUE INDEX events_source ON events (source_id);

CREATE TABLE rate_limits (
  key          TEXT NOT NULL,                     -- '<route>:<ip>'
  window_start INTEGER NOT NULL,                  -- unix seconds, start of the window
  count        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

ALTER TABLE orders ADD COLUMN landmark TEXT;

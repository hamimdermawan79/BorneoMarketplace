ALTER TABLE inventory_batches ADD COLUMN IF NOT EXISTS quantity_reserved numeric(14,3) NOT NULL DEFAULT 0 CHECK(quantity_reserved >= 0);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS idempotency_key uuid;
DROP INDEX IF EXISTS idx_orders_idempotency;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(created_by,idempotency_key) WHERE idempotency_key IS NOT NULL;

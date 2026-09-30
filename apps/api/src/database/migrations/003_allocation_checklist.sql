ALTER TABLE order_item_allocations ADD COLUMN IF NOT EXISTS prepared boolean NOT NULL DEFAULT false;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE TYPE user_role AS ENUM ('SUPERADMIN','ADMIN','BUYER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE organization_type AS ENUM ('COOPERATIVE','KITCHEN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE source_type AS ENUM ('COOPERATIVE','VENDOR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE order_status AS ENUM ('SUBMITTED','PREPARING','SHIPPED','AWAITING_KITCHEN','COMPLETED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type organization_type NOT NULL,
  name text NOT NULL,
  phone text,
  address text,
  gmaps_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role user_role NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_kitchens (
  admin_user_id uuid NOT NULL REFERENCES users(id),
  kitchen_id uuid NOT NULL REFERENCES organizations(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_user_id, kitchen_id)
);

CREATE TABLE IF NOT EXISTS product_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  image_path text,
  order_unit text NOT NULL,
  price_unit text NOT NULL,
  weighing_required boolean NOT NULL DEFAULT false,
  estimated_kg_per_unit numeric(12,4),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT weighing_required OR (price_unit = 'kg' AND estimated_kg_per_unit > 0))
);

CREATE TABLE IF NOT EXISTS admin_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES users(id),
  template_id uuid NOT NULL REFERENCES product_templates(id),
  sale_price numeric(14,2) NOT NULL CHECK (sale_price >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (admin_user_id, template_id)
);

CREATE TABLE IF NOT EXISTS vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  phone text,
  address text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_product_id uuid NOT NULL REFERENCES admin_products(id),
  source source_type NOT NULL,
  vendor_id uuid REFERENCES vendors(id),
  quantity_initial numeric(14,3) NOT NULL CHECK (quantity_initial > 0),
  quantity_available numeric(14,3) NOT NULL CHECK (quantity_available >= 0),
  cost_price numeric(14,2) CHECK (cost_price IS NULL OR cost_price >= 0),
  received_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES users(id),
  CHECK ((source = 'VENDOR' AND vendor_id IS NOT NULL) OR (source = 'COOPERATIVE' AND vendor_id IS NULL))
);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_no text NOT NULL UNIQUE,
  kitchen_id uuid NOT NULL REFERENCES organizations(id),
  admin_user_id uuid NOT NULL REFERENCES users(id),
  status order_status NOT NULL DEFAULT 'SUBMITTED',
  needed_date date NOT NULL,
  note text,
  estimated_total numeric(14,2) NOT NULL DEFAULT 0,
  final_total numeric(14,2),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_idempotency ON orders(created_by, note) WHERE note LIKE 'idempotency:%';

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  admin_product_id uuid NOT NULL REFERENCES admin_products(id),
  product_name text NOT NULL,
  ordered_quantity numeric(14,3) NOT NULL CHECK (ordered_quantity > 0),
  order_unit text NOT NULL,
  price_unit text NOT NULL,
  unit_price numeric(14,2) NOT NULL CHECK (unit_price >= 0),
  estimated_weight_kg numeric(14,3),
  actual_weight_kg numeric(14,3),
  estimated_total numeric(14,2) NOT NULL,
  final_total numeric(14,2),
  prepared boolean NOT NULL DEFAULT false,
  CHECK (actual_weight_kg IS NULL OR actual_weight_kg > 0)
);

CREATE TABLE IF NOT EXISTS order_item_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  inventory_batch_id uuid NOT NULL REFERENCES inventory_batches(id),
  source source_type NOT NULL,
  vendor_id uuid REFERENCES vendors(id),
  reserved_quantity numeric(14,3) NOT NULL CHECK (reserved_quantity > 0),
  actual_quantity numeric(14,3),
  UNIQUE (order_item_id, inventory_batch_id)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_batch_id uuid NOT NULL REFERENCES inventory_batches(id),
  order_id uuid REFERENCES orders(id),
  movement_type text NOT NULL CHECK (movement_type IN ('IN','RESERVE','RELEASE','OUT','ADJUSTMENT')),
  quantity numeric(14,3) NOT NULL,
  note text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status order_status,
  to_status order_status NOT NULL,
  changed_by uuid NOT NULL REFERENCES users(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_kitchens_kitchen ON admin_kitchens(kitchen_id);
CREATE INDEX IF NOT EXISTS idx_admin_products_owner ON admin_products(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product_source ON inventory_batches(admin_product_id, source);
CREATE INDEX IF NOT EXISTS idx_orders_admin_status ON orders(admin_user_id, status, needed_date);
CREATE INDEX IF NOT EXISTS idx_orders_kitchen ON orders(kitchen_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

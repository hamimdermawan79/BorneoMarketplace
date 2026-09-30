CREATE TABLE IF NOT EXISTS special_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_no text NOT NULL UNIQUE,
  kitchen_id uuid NOT NULL REFERENCES organizations(id),
  admin_user_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  quantity numeric(14,3) NOT NULL CHECK(quantity > 0),
  unit text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','APPROVED','REJECTED')),
  order_id uuid REFERENCES orders(id),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_special_requests_admin_status ON special_requests(admin_user_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_special_requests_kitchen ON special_requests(kitchen_id,created_at DESC);

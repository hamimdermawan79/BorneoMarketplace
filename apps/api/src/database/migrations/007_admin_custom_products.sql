ALTER TABLE product_templates
  ADD COLUMN IF NOT EXISTS owner_admin_user_id uuid REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_product_templates_owner_admin
  ON product_templates(owner_admin_user_id)
  WHERE owner_admin_user_id IS NOT NULL;

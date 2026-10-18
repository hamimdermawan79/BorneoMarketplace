-- Per-admin presentation overrides never mutate the shared master product.
ALTER TABLE admin_products
  ADD COLUMN name_override text CHECK (name_override IS NULL OR char_length(name_override) BETWEEN 2 AND 120),
  ADD COLUMN image_path_override text,
  ADD COLUMN image_override_set boolean NOT NULL DEFAULT false,
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN edit_version integer NOT NULL DEFAULT 0 CHECK (edit_version >= 0),
  ADD CONSTRAINT deleted_admin_product_inactive CHECK (deleted_at IS NULL OR NOT active);

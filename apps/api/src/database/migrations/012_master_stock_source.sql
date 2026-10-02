-- Existing products remain cooperative by default; never rewrite stock history.
ALTER TABLE product_templates ADD COLUMN stock_source source_type NOT NULL DEFAULT 'COOPERATIVE';

CREATE FUNCTION enforce_master_stock_source() RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM admin_products ap JOIN product_templates pt ON pt.id=ap.template_id
    WHERE ap.id=NEW.admin_product_id AND pt.owner_admin_user_id IS NULL
      AND pt.stock_source<>NEW.source
  ) THEN
    RAISE EXCEPTION 'Master product source mismatch' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER master_stock_source BEFORE INSERT OR UPDATE OF admin_product_id,source
ON inventory_batches FOR EACH ROW EXECUTE FUNCTION enforce_master_stock_source();

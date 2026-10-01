-- Reject ambiguous logins and invalid cross-cluster product/stock relations.
-- Existing inconsistent data stops this migration; it is never silently deleted.
CREATE UNIQUE INDEX users_email_casefold ON users (lower(email));
ALTER TABLE inventory_batches ADD CONSTRAINT stock_balance_valid CHECK (
  quantity_initial <> 'NaN'::numeric AND quantity_available <> 'NaN'::numeric AND quantity_reserved <> 'NaN'::numeric
  AND quantity_available + quantity_reserved <= quantity_initial);
ALTER TABLE admin_products ADD CONSTRAINT sale_price_finite CHECK (sale_price <> 'NaN'::numeric);
ALTER TABLE order_items ADD CONSTRAINT item_amounts_valid CHECK (
  ordered_quantity <> 'NaN'::numeric AND unit_price <> 'NaN'::numeric
  AND estimated_total >= 0 AND estimated_total <> 'NaN'::numeric
  AND (final_total IS NULL OR (final_total >= 0 AND final_total <> 'NaN'::numeric))
  AND (actual_weight_kg IS NULL OR actual_weight_kg <> 'NaN'::numeric));
ALTER TABLE orders ADD CONSTRAINT order_amounts_valid CHECK (
  estimated_total >= 0 AND estimated_total <> 'NaN'::numeric
  AND (final_total IS NULL OR (final_total >= 0 AND final_total <> 'NaN'::numeric)));
ALTER TABLE order_item_allocations ADD CONSTRAINT allocation_amounts_valid CHECK (
  reserved_quantity <> 'NaN'::numeric AND
  (actual_quantity IS NULL OR (actual_quantity >= 0 AND actual_quantity <> 'NaN'::numeric)));
ALTER TABLE special_requests ADD CONSTRAINT request_quantity_finite CHECK (quantity <> 'NaN'::numeric);

CREATE FUNCTION enforce_inventory_tenant() RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_TABLE_NAME = 'admin_products' THEN
    IF NOT EXISTS (SELECT 1 FROM product_templates p WHERE p.id=NEW.template_id
      AND (p.owner_admin_user_id IS NULL OR p.owner_admin_user_id=NEW.admin_user_id)) THEN
      RAISE EXCEPTION 'Product ownership mismatch' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'inventory_batches' THEN
    IF NEW.vendor_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM vendors v JOIN admin_products p ON p.admin_user_id=v.admin_user_id
      WHERE v.id=NEW.vendor_id AND p.id=NEW.admin_product_id) THEN
      RAISE EXCEPTION 'Vendor ownership mismatch' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'order_items' THEN
    IF NOT EXISTS (SELECT 1 FROM orders o JOIN admin_products p ON p.admin_user_id=o.admin_user_id
      WHERE o.id=NEW.order_id AND p.id=NEW.admin_product_id) THEN
      RAISE EXCEPTION 'Order product ownership mismatch' USING ERRCODE='23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'order_item_allocations' THEN
    IF NOT EXISTS (SELECT 1 FROM order_items i JOIN inventory_batches b ON b.admin_product_id=i.admin_product_id
      WHERE i.id=NEW.order_item_id AND b.id=NEW.inventory_batch_id AND b.source=NEW.source
      AND b.vendor_id IS NOT DISTINCT FROM NEW.vendor_id) THEN
      RAISE EXCEPTION 'Allocation ownership mismatch' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER admin_product_tenant BEFORE INSERT OR UPDATE OF admin_user_id,template_id ON admin_products FOR EACH ROW EXECUTE FUNCTION enforce_inventory_tenant();
CREATE TRIGGER inventory_vendor_tenant BEFORE INSERT OR UPDATE OF admin_product_id,vendor_id,source ON inventory_batches FOR EACH ROW EXECUTE FUNCTION enforce_inventory_tenant();
CREATE TRIGGER order_item_tenant BEFORE INSERT OR UPDATE OF order_id,admin_product_id ON order_items FOR EACH ROW EXECUTE FUNCTION enforce_inventory_tenant();
CREATE TRIGGER allocation_tenant BEFORE INSERT OR UPDATE OF order_item_id,inventory_batch_id,source,vendor_id ON order_item_allocations FOR EACH ROW EXECUTE FUNCTION enforce_inventory_tenant();

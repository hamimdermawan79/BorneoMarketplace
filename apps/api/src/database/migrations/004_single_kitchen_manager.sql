WITH ranked AS (
  SELECT ctid, row_number() OVER (PARTITION BY kitchen_id ORDER BY created_at, admin_user_id) AS position
  FROM admin_kitchens
)
DELETE FROM admin_kitchens WHERE ctid IN (SELECT ctid FROM ranked WHERE position > 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_kitchens_one_manager ON admin_kitchens(kitchen_id);

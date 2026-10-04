-- Keep historical foreign keys intact when an inactive account is removed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE users ADD CONSTRAINT deleted_users_stay_inactive
  CHECK (deleted_at IS NULL OR NOT active);
CREATE INDEX idx_users_visible ON users(role,full_name) WHERE deleted_at IS NULL;

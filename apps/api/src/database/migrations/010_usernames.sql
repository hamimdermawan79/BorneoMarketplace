ALTER TABLE users ADD COLUMN username text;
DO $$
DECLARE account record; candidate text;
BEGIN
  FOR account IN SELECT id,email FROM users ORDER BY created_at,id LOOP
    candidate := left(regexp_replace(lower(split_part(coalesce(account.email,''),'@',1)), '[^a-z0-9._-]', '', 'g'),32);
    IF length(candidate)<3 THEN candidate := 'user'; END IF;
    IF EXISTS(SELECT 1 FROM users WHERE username=candidate) THEN
      candidate := candidate || '-' || left(replace(account.id::text,'-',''),24);
    END IF;
    UPDATE users SET username=candidate WHERE id=account.id;
  END LOOP;
END $$;
ALTER TABLE users ALTER COLUMN username SET DEFAULT ('user-' || replace(gen_random_uuid()::text,'-',''));
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_username_format CHECK (username ~ '^[a-z0-9][a-z0-9._-]{2,63}$');
CREATE UNIQUE INDEX users_username_unique ON users(lower(username));
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

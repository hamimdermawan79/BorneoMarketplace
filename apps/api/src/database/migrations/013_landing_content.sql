CREATE TABLE landing_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  headline text NOT NULL CHECK (length(headline) BETWEEN 3 AND 180),
  thumbnail text NOT NULL,
  destination text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE landing_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  headline text NOT NULL CHECK (length(headline) BETWEEN 3 AND 180),
  thumbnail text NOT NULL DEFAULT '',
  destination text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX landing_news_published ON landing_news(active,created_at DESC);
CREATE INDEX landing_prices_published ON landing_prices(active,created_at DESC);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='borneo_runtime') THEN
    GRANT SELECT,INSERT,UPDATE,DELETE ON landing_news,landing_prices TO borneo_runtime;
  END IF;
END $$;

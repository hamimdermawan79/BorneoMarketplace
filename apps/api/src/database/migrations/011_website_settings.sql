CREATE TABLE website_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id=1),
  whatsapp text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  instagram text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT 'Sambas, Kalimantan Barat',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO website_settings(id) VALUES(1);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='borneo_runtime') THEN
    GRANT SELECT,UPDATE ON website_settings TO borneo_runtime;
  END IF;
END $$;

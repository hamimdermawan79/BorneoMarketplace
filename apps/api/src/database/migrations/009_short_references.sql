-- Never reset this sequence when clearing demo orders.
CREATE SEQUENCE public.document_reference_seq AS bigint START WITH 1 NO CYCLE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'borneo_runtime') THEN
    GRANT USAGE, SELECT ON SEQUENCE public.document_reference_seq TO borneo_runtime;
  END IF;
END $$;

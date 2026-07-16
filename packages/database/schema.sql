-- Migrate the early user-managed integer index to an internal UUID without
-- dropping account, upgrade, or export data. legacy_index is cleared by the
-- collector after any index-named data directory has been moved to the UUID.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounts' AND column_name = 'account_index'
  ) THEN
    ALTER TABLE accounts ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
    ALTER TABLE accounts ADD COLUMN IF NOT EXISTS legacy_index integer;
    UPDATE accounts SET id = gen_random_uuid() WHERE id IS NULL;
    UPDATE accounts SET legacy_index = account_index WHERE legacy_index IS NULL;

    IF to_regclass('public.manual_upgrades') IS NOT NULL THEN
      ALTER TABLE manual_upgrades ADD COLUMN IF NOT EXISTS account_id uuid;
      UPDATE manual_upgrades u SET account_id = a.id
      FROM accounts a WHERE u.account_index = a.account_index AND u.account_id IS NULL;
      ALTER TABLE manual_upgrades DROP COLUMN account_index CASCADE;
    END IF;

    IF to_regclass('public.village_exports') IS NOT NULL THEN
      ALTER TABLE village_exports ADD COLUMN IF NOT EXISTS account_id uuid;
      UPDATE village_exports e SET account_id = a.id
      FROM accounts a WHERE e.account_index = a.account_index AND e.account_id IS NULL;
      ALTER TABLE village_exports DROP COLUMN account_index CASCADE;
    END IF;

    ALTER TABLE accounts DROP COLUMN account_index CASCADE;
    ALTER TABLE accounts ALTER COLUMN id SET DEFAULT gen_random_uuid();
    ALTER TABLE accounts ALTER COLUMN id SET NOT NULL;
    ALTER TABLE accounts ADD PRIMARY KEY (id);

    IF to_regclass('public.manual_upgrades') IS NOT NULL THEN
      ALTER TABLE manual_upgrades ALTER COLUMN account_id SET NOT NULL;
      ALTER TABLE manual_upgrades ADD CONSTRAINT manual_upgrades_account_id_fkey
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
    END IF;

    IF to_regclass('public.village_exports') IS NOT NULL THEN
      ALTER TABLE village_exports ALTER COLUMN account_id SET NOT NULL;
      ALTER TABLE village_exports ADD CONSTRAINT village_exports_account_id_fkey
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_index integer,
  label text NOT NULL,
  player_tag text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#4c9a79',
  api_key text NOT NULL,
  source_url text NOT NULL DEFAULT '',
  clash_api_token text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS manual_upgrades (
  id bigserial PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('building', 'hero', 'pet', 'research')),
  current_level integer NOT NULL DEFAULT 0,
  next_level integer NOT NULL DEFAULT 1,
  started_at timestamptz NOT NULL,
  finish_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS manual_upgrades_account_status_idx
  ON manual_upgrades (account_id, status, finish_at);

CREATE TABLE IF NOT EXISTS village_exports (
  id bigserial PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  player_tag text NOT NULL,
  exported_at timestamptz NOT NULL,
  raw jsonb NOT NULL,
  normalized jsonb NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS accounts_legacy_index_unique_idx ON accounts (legacy_index) WHERE legacy_index IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS village_exports_account_exported_unique_idx ON village_exports (account_id, exported_at);
CREATE INDEX IF NOT EXISTS village_exports_latest_idx ON village_exports (account_id, exported_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_unique_player_tag_idx ON accounts (upper(player_tag)) WHERE player_tag <> '';

CREATE TABLE IF NOT EXISTS snapshot_logs (
  id bigserial PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL,
  data_source text NOT NULL,
  snapshot jsonb NOT NULL,
  source jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS snapshot_logs_account_captured_idx
  ON snapshot_logs (account_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS event_logs (
  id bigserial PRIMARY KEY,
  event_id text NOT NULL UNIQUE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_logs_account_occurred_idx
  ON event_logs (account_id, occurred_at DESC);

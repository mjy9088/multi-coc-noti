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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE accounts DROP COLUMN IF EXISTS source_api_token;
ALTER TABLE accounts DROP COLUMN IF EXISTS clash_api_token;

CREATE TABLE IF NOT EXISTS tracked_upgrades (
  id bigserial PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('export', 'snapshot')),
  source_key text NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('building', 'hero', 'pet', 'research')),
  current_level integer NOT NULL DEFAULT 0,
  next_level integer NOT NULL DEFAULT 1,
  started_at timestamptz NOT NULL,
  finish_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  notification_offsets integer[] NOT NULL DEFAULT ARRAY[60, 1, 0],
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tracked_upgrades_source_key_idx
  ON tracked_upgrades (account_id, source, source_key);
CREATE INDEX IF NOT EXISTS tracked_upgrades_account_status_idx
  ON tracked_upgrades (account_id, status, finish_at);

DROP TABLE IF EXISTS manual_upgrades;
DELETE FROM tracked_upgrades WHERE source = 'manual';
ALTER TABLE tracked_upgrades ALTER COLUMN source DROP DEFAULT;
ALTER TABLE tracked_upgrades DROP CONSTRAINT IF EXISTS tracked_upgrades_source_check;
ALTER TABLE tracked_upgrades ADD CONSTRAINT tracked_upgrades_source_check CHECK (source IN ('export', 'snapshot'));

CREATE TABLE IF NOT EXISTS upgrade_notifications (
  id bigserial PRIMARY KEY,
  upgrade_id bigint NOT NULL REFERENCES tracked_upgrades(id) ON DELETE CASCADE,
  minutes_before integer NOT NULL CHECK (minutes_before >= 0),
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'skipped')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (upgrade_id, minutes_before)
);

ALTER TABLE upgrade_notifications DROP CONSTRAINT IF EXISTS upgrade_notifications_status_check;
ALTER TABLE upgrade_notifications ADD CONSTRAINT upgrade_notifications_status_check
  CHECK (status IN ('pending', 'processing', 'sent', 'skipped'));

CREATE INDEX IF NOT EXISTS upgrade_notifications_due_idx
  ON upgrade_notifications (status, next_attempt_at, scheduled_at);

INSERT INTO upgrade_notifications (upgrade_id, minutes_before, scheduled_at)
SELECT u.id, offset_value, u.finish_at - make_interval(mins => offset_value)
FROM tracked_upgrades u
CROSS JOIN LATERAL unnest(u.notification_offsets) AS offset_value
WHERE u.status = 'active'
  AND (u.finish_at - make_interval(mins => offset_value) > now() OR offset_value = 0)
ON CONFLICT (upgrade_id, minutes_before) DO NOTHING;

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

-- Bring the latest game export into the unified tracker during upgrades from
-- versions that stored export timers only inside village_exports.normalized.
WITH latest AS (
  SELECT DISTINCT ON (account_id) account_id, exported_at, normalized
  FROM village_exports ORDER BY account_id, exported_at DESC
), export_upgrades AS (
  SELECT latest.account_id, latest.exported_at, value
  FROM latest CROSS JOIN LATERAL jsonb_array_elements(COALESCE(latest.normalized->'upgrades', '[]'::jsonb)) AS value
)
INSERT INTO tracked_upgrades (
  account_id, source, source_key, name, type, current_level, next_level,
  started_at, finish_at, status, last_seen_at
)
SELECT account_id, 'export', value->>'id', value->>'name', value->>'type',
  COALESCE((value->>'level')::integer, 0), COALESCE((value->>'nextLevel')::integer, 1),
  COALESCE(NULLIF(value->>'startedAt', '')::timestamptz, exported_at),
  (value->>'finishAt')::timestamptz,
  CASE WHEN (value->>'finishAt')::timestamptz > now() THEN 'active' ELSE 'completed' END,
  exported_at
FROM export_upgrades
WHERE value->>'id' IS NOT NULL
  AND value->>'type' IN ('building', 'hero', 'pet', 'research')
  AND value->>'finishAt' IS NOT NULL
ON CONFLICT (account_id, source, source_key) DO NOTHING;

INSERT INTO upgrade_notifications (upgrade_id, minutes_before, scheduled_at)
SELECT u.id, offset_value, u.finish_at - make_interval(mins => offset_value)
FROM tracked_upgrades u
CROSS JOIN LATERAL unnest(u.notification_offsets) AS offset_value
WHERE u.status = 'active'
  AND (u.finish_at - make_interval(mins => offset_value) > now() OR offset_value = 0)
ON CONFLICT (upgrade_id, minutes_before) DO NOTHING;

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

DROP TABLE IF EXISTS event_logs;

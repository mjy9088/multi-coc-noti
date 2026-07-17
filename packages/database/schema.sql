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
  tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT ARRAY[]::text[];
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS resource_status text NOT NULL DEFAULT 'unanswered';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS resource_status_updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS resource_preparation_minutes integer DEFAULT 60;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_resource_status_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_resource_status_check
  CHECK (resource_status IN ('abundant', 'sufficient', 'insufficient', 'unanswered'));
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_resource_preparation_minutes_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_resource_preparation_minutes_check
  CHECK (resource_preparation_minutes IS NULL OR resource_preparation_minutes BETWEEN 1 AND 525600);

ALTER TABLE accounts DROP COLUMN IF EXISTS source_api_token;
ALTER TABLE accounts DROP COLUMN IF EXISTS clash_api_token;
ALTER TABLE accounts DROP COLUMN IF EXISTS api_key;
ALTER TABLE accounts DROP COLUMN IF EXISTS source_url;

CREATE TABLE IF NOT EXISTS dashboard_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  group_order text[] NOT NULL DEFAULT ARRAY[]::text[],
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tracked_upgrades (
  id bigserial PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('export', 'snapshot')),
  source_key text NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('building', 'hero', 'pet', 'research')),
  base text NOT NULL DEFAULT 'home' CHECK (base IN ('home', 'builder')),
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

ALTER TABLE tracked_upgrades ADD COLUMN IF NOT EXISTS resource_preparation_override_minutes integer;
ALTER TABLE tracked_upgrades ADD COLUMN IF NOT EXISTS base text NOT NULL DEFAULT 'home';
ALTER TABLE tracked_upgrades DROP CONSTRAINT IF EXISTS tracked_upgrades_base_check;
ALTER TABLE tracked_upgrades ADD CONSTRAINT tracked_upgrades_base_check CHECK (base IN ('home', 'builder'));
ALTER TABLE tracked_upgrades DROP CONSTRAINT IF EXISTS tracked_upgrades_resource_preparation_override_check;
ALTER TABLE tracked_upgrades ADD CONSTRAINT tracked_upgrades_resource_preparation_override_check
  CHECK (resource_preparation_override_minutes IS NULL OR resource_preparation_override_minutes BETWEEN 0 AND 525600);

CREATE UNIQUE INDEX IF NOT EXISTS tracked_upgrades_source_key_idx
  ON tracked_upgrades (account_id, source, source_key);
CREATE INDEX IF NOT EXISTS tracked_upgrades_account_status_idx
  ON tracked_upgrades (account_id, status, finish_at);

DROP TABLE IF EXISTS manual_upgrades;
DELETE FROM tracked_upgrades WHERE source = 'manual';
ALTER TABLE tracked_upgrades ALTER COLUMN source DROP DEFAULT;
ALTER TABLE tracked_upgrades DROP CONSTRAINT IF EXISTS tracked_upgrades_source_check;
DELETE FROM tracked_upgrades WHERE source='snapshot';
ALTER TABLE tracked_upgrades ADD CONSTRAINT tracked_upgrades_source_check CHECK (source = 'export');

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
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE upgrade_notifications ADD COLUMN IF NOT EXISTS notification_kind text;
ALTER TABLE upgrade_notifications ADD COLUMN IF NOT EXISTS preparation_minutes integer;
UPDATE upgrade_notifications SET notification_kind=CASE
  WHEN minutes_before=0 THEN 'completion'
  WHEN minutes_before=1 THEN 'one_minute'
  WHEN minutes_before=60 THEN 'resource_preparation'
  ELSE 'legacy'
END WHERE notification_kind IS NULL;
ALTER TABLE upgrade_notifications ALTER COLUMN notification_kind SET NOT NULL;
ALTER TABLE upgrade_notifications DROP CONSTRAINT IF EXISTS upgrade_notifications_notification_kind_check;
ALTER TABLE upgrade_notifications ADD CONSTRAINT upgrade_notifications_notification_kind_check
  CHECK (notification_kind IN ('completion', 'one_minute', 'resource_preparation', 'refresh_required', 'legacy'));
ALTER TABLE upgrade_notifications DROP CONSTRAINT IF EXISTS upgrade_notifications_upgrade_id_minutes_before_key;
CREATE UNIQUE INDEX IF NOT EXISTS upgrade_notifications_policy_kind_idx
  ON upgrade_notifications (upgrade_id, notification_kind) WHERE notification_kind <> 'legacy';

ALTER TABLE upgrade_notifications DROP CONSTRAINT IF EXISTS upgrade_notifications_status_check;
ALTER TABLE upgrade_notifications ADD CONSTRAINT upgrade_notifications_status_check
  CHECK (status IN ('pending', 'processing', 'sent', 'skipped'));

CREATE INDEX IF NOT EXISTS upgrade_notifications_due_idx
  ON upgrade_notifications (status, next_attempt_at, scheduled_at);

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
  account_id, source, source_key, name, type, base, current_level, next_level,
  started_at, finish_at, status, last_seen_at
)
SELECT account_id, 'export', value->>'id', value->>'name', value->>'type',
  CASE WHEN value->>'base'='builder' THEN 'builder' ELSE 'home' END,
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

-- Older tracker rows predate base classification. Recover it from the newest
-- export so existing Builder Base work is classified correctly immediately.
WITH latest AS (
  SELECT DISTINCT ON (account_id) account_id, normalized
  FROM village_exports ORDER BY account_id, exported_at DESC
), export_upgrades AS (
  SELECT latest.account_id, value
  FROM latest CROSS JOIN LATERAL jsonb_array_elements(COALESCE(latest.normalized->'upgrades', '[]'::jsonb)) AS value
)
UPDATE tracked_upgrades tracked SET base=CASE WHEN export_upgrades.value->>'base'='builder' THEN 'builder' ELSE 'home' END
FROM export_upgrades
WHERE tracked.account_id=export_upgrades.account_id AND tracked.source='export'
  AND tracked.source_key=export_upgrades.value->>'id';

-- Replace pending reminders from the legacy fixed-offset policy. Sent rows stay
-- immutable so an account setting change never sends the same event twice.
CREATE TABLE IF NOT EXISTS app_migrations (
  key text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TEMP TABLE resource_policy_migration_needed AS
  SELECT NOT EXISTS (SELECT 1 FROM app_migrations WHERE key='resource-notification-policy-v1') AS needed;
INSERT INTO app_migrations (key) VALUES ('resource-notification-policy-v1') ON CONFLICT DO NOTHING;

DELETE FROM upgrade_notifications
WHERE status <> 'sent' AND (SELECT needed FROM resource_policy_migration_needed);

INSERT INTO upgrade_notifications (upgrade_id, minutes_before, notification_kind, preparation_minutes, scheduled_at, next_attempt_at)
SELECT u.id, 0, 'completion', NULL, u.finish_at, u.finish_at
FROM tracked_upgrades u JOIN accounts a ON a.id=u.account_id
WHERE (SELECT needed FROM resource_policy_migration_needed)
  AND u.status='active' AND a.resource_status IN ('abundant', 'insufficient', 'unanswered')
ON CONFLICT (upgrade_id, notification_kind) WHERE notification_kind <> 'legacy' DO NOTHING;

INSERT INTO upgrade_notifications (upgrade_id, minutes_before, notification_kind, preparation_minutes, scheduled_at, next_attempt_at)
SELECT u.id, 1, 'one_minute', NULL, u.finish_at - interval '1 minute', u.finish_at - interval '1 minute'
FROM tracked_upgrades u JOIN accounts a ON a.id=u.account_id
WHERE (SELECT needed FROM resource_policy_migration_needed)
  AND u.status='active' AND a.resource_status='sufficient' AND u.finish_at - interval '1 minute' > now()
ON CONFLICT (upgrade_id, notification_kind) WHERE notification_kind <> 'legacy' DO NOTHING;

INSERT INTO upgrade_notifications (upgrade_id, minutes_before, notification_kind, preparation_minutes, scheduled_at, next_attempt_at)
SELECT u.id, a.resource_preparation_minutes, 'resource_preparation', a.resource_preparation_minutes,
  GREATEST(now(), u.finish_at - make_interval(mins => a.resource_preparation_minutes)),
  GREATEST(now(), u.finish_at - make_interval(mins => a.resource_preparation_minutes))
FROM tracked_upgrades u JOIN accounts a ON a.id=u.account_id
WHERE (SELECT needed FROM resource_policy_migration_needed)
  AND u.status='active' AND a.resource_status IN ('insufficient', 'unanswered')
  AND a.resource_preparation_minutes IS NOT NULL
ON CONFLICT (upgrade_id, notification_kind) WHERE notification_kind <> 'legacy' DO NOTHING;

CREATE TABLE IF NOT EXISTS resource_reminder_suppressions (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  notification_id bigint NOT NULL REFERENCES upgrade_notifications(id) ON DELETE CASCADE,
  suppress_until timestamptz NOT NULL,
  preparation_minutes integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO resource_reminder_suppressions (account_id,notification_id,suppress_until,preparation_minutes)
SELECT DISTINCT ON (u.account_id) u.account_id,n.id,
  n.sent_at + (COALESCE(n.preparation_minutes,n.minutes_before) * interval '1 minute'),
  COALESCE(n.preparation_minutes,n.minutes_before)
FROM upgrade_notifications n JOIN tracked_upgrades u ON u.id=n.upgrade_id
WHERE (SELECT needed FROM resource_policy_migration_needed)
  AND n.notification_kind='resource_preparation' AND n.status='sent' AND n.sent_at IS NOT NULL
  AND COALESCE(n.preparation_minutes,n.minutes_before)>0
  AND n.sent_at + (COALESCE(n.preparation_minutes,n.minutes_before) * interval '1 minute')>now()
ORDER BY u.account_id,n.sent_at DESC
ON CONFLICT (account_id) DO NOTHING;
DROP TABLE resource_policy_migration_needed;

INSERT INTO upgrade_notifications (upgrade_id,minutes_before,notification_kind,preparation_minutes,scheduled_at,next_attempt_at)
SELECT id,0,'refresh_required',NULL,finish_at + interval '24 hours',finish_at + interval '24 hours'
FROM tracked_upgrades WHERE status='active'
ON CONFLICT (upgrade_id,notification_kind) WHERE notification_kind<>'legacy' DO NOTHING;

CREATE TABLE IF NOT EXISTS snapshot_logs (
  id bigserial PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL,
  data_source text NOT NULL,
  snapshot jsonb NOT NULL,
  source jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

WITH latest AS (
  SELECT DISTINCT ON (account_id) account_id, snapshot
  FROM snapshot_logs ORDER BY account_id, captured_at DESC
), snapshot_upgrades AS (
  SELECT latest.account_id, value
  FROM latest CROSS JOIN LATERAL jsonb_array_elements(COALESCE(latest.snapshot->'upgrades', '[]'::jsonb)) AS value
)
UPDATE tracked_upgrades tracked SET base=CASE WHEN snapshot_upgrades.value->>'base'='builder' THEN 'builder' ELSE 'home' END
FROM snapshot_upgrades
WHERE tracked.account_id=snapshot_upgrades.account_id AND tracked.source='snapshot'
  AND tracked.source_key=snapshot_upgrades.value->>'id';

-- Older versions allowed the same collected document to be inserted more than
-- once. Keep the first copy so history imports can use a stable conflict key.
DELETE FROM snapshot_logs newer
USING snapshot_logs older
WHERE newer.account_id = older.account_id
  AND newer.captured_at = older.captured_at
  AND newer.data_source = older.data_source
  AND newer.id > older.id;

CREATE UNIQUE INDEX IF NOT EXISTS snapshot_logs_account_capture_source_unique_idx
  ON snapshot_logs (account_id, captured_at, data_source);
CREATE INDEX IF NOT EXISTS snapshot_logs_account_captured_idx
  ON snapshot_logs (account_id, captured_at DESC);

DROP TABLE IF EXISTS event_logs;

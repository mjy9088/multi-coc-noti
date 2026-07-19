import assert from "node:assert/strict";
import test from "node:test";
import { sql } from "drizzle-orm";

const databaseUrl = process.env.DATABASE_TEST_URL;

test("[DB-MIGRATION-001] fresh and legacy PostgreSQL databases converge on the Drizzle schema without data loss", {
  skip: !databaseUrl,
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const {
    closeDatabase,
    createAccount,
    database,
    drizzleDatabase,
    getDashboardSettings,
    listAccounts,
    migrate,
    updateDashboardSettings,
  } = await import("../index.ts");

  await database().query("DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await migrate();
  const account = await createAccount({
    label: "Fresh village",
    playerTag: "#2ABC",
    color: "#112233",
    tags: ["Main"],
  });
  assert.equal((await listAccounts())[0]?.id, account.id);
  await database().query("INSERT INTO users (id,name) VALUES ('test-user','Test User')");
  assert.deepEqual(await getDashboardSettings("test-user"), { groupOrder: [] });
  assert.deepEqual(await updateDashboardSettings("test-user", ["Main", "War"]), { groupOrder: ["Main", "War"] });
  const migrationCount = Number(
    (await database().query("SELECT count(*) FROM drizzle.__drizzle_migrations")).rows[0].count,
  );
  assert.ok(migrationCount > 0);
  assert.equal(
    (await drizzleDatabase().execute(sql`select count(*)::integer AS count from accounts`)).rows[0]?.count,
    1,
  );

  await database().query("DROP SCHEMA drizzle CASCADE");
  await migrate();
  assert.equal((await listAccounts())[0]?.id, account.id);
  assert.equal(
    Number((await database().query("SELECT count(*) FROM drizzle.__drizzle_migrations")).rows[0].count),
    migrationCount,
  );
  await closeDatabase();
});

test("[AUTH-ISOLATION-001] users can track the same player tag without reading or mutating each other's data", {
  skip: !databaseUrl,
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const {
    closeDatabase,
    createAccount,
    database,
    deleteAccount,
    getDashboardSettings,
    listAccounts,
    listNotificationChannels,
    listSyncHistory,
    migrate,
    saveBarkChannel,
    saveVillageExport,
    updateAccount,
    updateDashboardSettings,
  } = await import("../index.ts");
  await migrate();
  await database().query(
    "INSERT INTO users (id,name) VALUES ('isolation-a','User A'),('isolation-b','User B') ON CONFLICT DO NOTHING",
  );

  const villageA = await createAccount(
    { label: "A village", playerTag: "#SHARED", color: "#112233", tags: ["A"] },
    "isolation-a",
  );
  const villageB = await createAccount(
    { label: "B village", playerTag: "#SHARED", color: "#445566", tags: ["B"] },
    "isolation-b",
  );
  assert.deepEqual(
    (await listAccounts("isolation-a")).map(({ id }) => id),
    [villageA.id],
  );
  assert.deepEqual(
    (await listAccounts("isolation-b")).map(({ id }) => id),
    [villageB.id],
  );
  assert.equal(
    await updateAccount(
      villageB.id,
      { label: "Not mine", playerTag: "#SHARED", color: "#000000", tags: [] },
      "isolation-a",
    ),
    null,
  );
  assert.equal(await deleteAccount(villageB.id, "isolation-a"), false);

  await updateDashboardSettings("isolation-a", ["Home"]);
  assert.deepEqual(await getDashboardSettings("isolation-a"), { groupOrder: ["Home"] });
  assert.deepEqual(await getDashboardSettings("isolation-b"), { groupOrder: [] });
  await saveBarkChannel("isolation-a", {
    label: "A phone",
    enabled: true,
    locale: "ko",
    baseUrl: "https://api.day.app",
    deviceKey: "a-device",
  });
  assert.equal((await listNotificationChannels("isolation-a")).length, 1);
  assert.equal((await listNotificationChannels("isolation-b")).length, 0);

  const exportedAt = new Date().toISOString();
  await saveVillageExport(villageA.id, {
    tag: "#SHARED",
    exportedAt,
    townHall: 17,
    builders: { total: 6, free: 6 },
    upgrades: [],
    unknownDataIds: [],
    raw: { tag: "#SHARED", timestamp: exportedAt },
  });
  assert.equal((await listSyncHistory({ accountIds: [villageA.id] })).length, 1);
  assert.equal((await listSyncHistory({ accountIds: [villageB.id] })).length, 0);
  await closeDatabase();
});

test("[AUTH-TEST-001] local test login creates an Auth.js-compatible database session", {
  skip: !databaseUrl,
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const { authenticateSessionToken, closeDatabase, createLocalTestSession, migrate } = await import("../index.ts");
  await migrate();
  const expires = new Date(Date.now() + 60_000);
  await createLocalTestSession({
    userId: "test-session-user",
    username: "Local tester",
    sessionToken: "local-test-session-token",
    expires,
  });
  assert.deepEqual(await authenticateSessionToken("local-test-session-token"), {
    id: "test-session-user",
    name: "Local tester",
    email: null,
    image: null,
  });
  await closeDatabase();
});

test("[DB-HISTORY-001] village history export and import rebuild exports and tracked upgrades atomically", {
  skip: !databaseUrl,
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const {
    closeDatabase,
    createAccount,
    deleteAccount,
    exportVillageHistories,
    importVillageHistory,
    listSyncHistory,
    listTrackedUpgrades,
    listUpgradeHistory,
    migrate,
    saveVillageExport,
    updateUpgradePreparationOverride,
  } = await import("../index.ts");
  await migrate();
  const account = await createAccount({ label: "Backup village", playerTag: "#BACKUP", color: "#456789", tags: [] });
  const observedAt = new Date(Date.now() - 60_000).toISOString();
  const finishAt = new Date(Date.now() + 7_200_000).toISOString();
  await saveVillageExport(account.id, {
    tag: "#BACKUP",
    exportedAt: observedAt,
    townHall: 17,
    builders: { total: 6, free: 5 },
    upgrades: [{ id: "building:100:2", name: "Cannon", level: 1, nextLevel: 2, type: "building", finishAt }],
    unknownDataIds: [],
    raw: { tag: "#BACKUP", timestamp: observedAt },
  });
  const [bundle] = await exportVillageHistories(account.id);
  assert.equal(bundle.villageExports.length, 1);
  await deleteAccount(account.id);
  const restored = await importVillageHistory(bundle);
  assert.equal(restored.created, true);
  assert.equal(restored.villageExports, 1);
  const upgrades = await listTrackedUpgrades({ activeOnly: true });
  assert.equal(upgrades.length, 1);
  const upgrade = upgrades[0];
  assert.ok(upgrade);
  assert.equal(upgrade.sourceKey, "building:100:2");
  assert.equal((await listUpgradeHistory({ accountId: restored.accountId, active: true }))[0]?.id, upgrade.id);
  assert.equal((await listSyncHistory({ accountId: restored.accountId }))[0]?.builderUpgrades, 0);
  assert.equal((await updateUpgradePreparationOverride(upgrade.id, null))?.resourcePreparationOverrideMinutes, null);
  await closeDatabase();
});

test("[DB-NOTIFICATION-001] notification claiming is exclusive and failure releases resource suppression for retry", {
  skip: !databaseUrl,
}, async () => {
  process.env.DATABASE_URL = databaseUrl;
  const {
    claimDueChannelDeliveries,
    claimDueNotifications,
    closeDatabase,
    database,
    markChannelDeliveryFailed,
    markChannelDeliverySent,
    markNotificationFailed,
    migrate,
  } = await import("../index.ts");
  await migrate();
  const notification = (
    await database().query(
      `SELECT n.id,u.account_id FROM upgrade_notifications n
       JOIN tracked_upgrades u ON u.id=n.upgrade_id
       WHERE n.notification_kind='resource_preparation' LIMIT 1`,
    )
  ).rows[0];
  assert.ok(notification);
  await database().query("INSERT INTO users (id,name) VALUES ('notification-user','Notification User')");
  await database().query("UPDATE accounts SET user_id='notification-user' WHERE id=$1", [notification.account_id]);
  await database().query(
    "UPDATE upgrade_notifications SET scheduled_at=now(),next_attempt_at=now(),status='pending' WHERE id=$1",
    [notification.id],
  );
  const first = await claimDueNotifications(20);
  const second = await claimDueNotifications(20);
  assert.equal(first.filter((item) => item.id === String(notification.id)).length, 1);
  assert.equal(second.filter((item) => item.id === String(notification.id)).length, 0);
  await markNotificationFailed(String(notification.id), "temporary failure", new Date(Date.now() - 60_000));
  assert.equal(
    Number(
      (
        await database().query("SELECT count(*) FROM resource_reminder_suppressions WHERE notification_id=$1", [
          notification.id,
        ])
      ).rows[0].count,
    ),
    0,
  );
  assert.equal(
    (await database().query("SELECT status FROM upgrade_notifications WHERE id=$1", [notification.id])).rows[0].status,
    "pending",
  );

  const channel = (
    await database().query(
      `INSERT INTO notification_channels (user_id,label,channel_type)
       VALUES ('notification-user','Primary iPhone','bark') RETURNING id`,
    )
  ).rows[0];
  await database().query(
    `INSERT INTO bark_channel_settings (channel_id,base_url,device_key,default_group)
     VALUES ($1,'https://api.day.app','managed-device','Managed')`,
    [channel.id],
  );
  await database().query(
    `INSERT INTO notification_delivery_rules
      (channel_id,notification_kind,sound,interruption_level,target_url)
     VALUES ($1,'resource_preparation','glass','timeSensitive','https://coc.example/villages/main')`,
    [channel.id],
  );
  const managed = await claimDueChannelDeliveries(20);
  assert.ok(managed);
  const delivery = managed.find((item) => item.id === String(notification.id));
  assert.ok(delivery);
  assert.equal(delivery.channel.deviceKey, "managed-device");
  assert.equal(delivery.rule.sound, "glass");
  assert.equal((await claimDueChannelDeliveries(20))?.length, 0);
  await markChannelDeliveryFailed(delivery.deliveryId, "temporary managed failure", new Date(Date.now() - 60_000));
  assert.equal(
    Number(
      (
        await database().query("SELECT count(*) FROM notification_delivery_suppressions WHERE notification_id=$1", [
          notification.id,
        ])
      ).rows[0].count,
    ),
    0,
  );
  const retried = await claimDueChannelDeliveries(20);
  const retriedDelivery = retried?.find((item) => item.deliveryId === delivery.deliveryId);
  assert.ok(retriedDelivery);
  await markChannelDeliverySent(retriedDelivery.deliveryId);
  assert.equal(
    (await database().query("SELECT status FROM notification_deliveries WHERE id=$1", [delivery.deliveryId])).rows[0]
      .status,
    "sent",
  );
  assert.equal(
    (await database().query("SELECT status FROM upgrade_notifications WHERE id=$1", [notification.id])).rows[0].status,
    "sent",
  );
  await closeDatabase();
});

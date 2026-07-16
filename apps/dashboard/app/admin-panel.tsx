"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import UpgradeAvailabilityPanel from "./upgrade-availability-panel";
import { useDashboardFormat } from "./use-dashboard-format";

type Account = { id: string; label: string; playerTag: string; color: string; sourceUrl: string; hasApiKey: boolean };
type Upgrade = { id: string; accountId: string; name: string; type: string; level: number; nextLevel: number; finishAt: string; status: string; source: "export" | "snapshot"; notificationOffsets: number[] };
type ExportPreview = {
  tag: string; exportedAt: string; townHall: number; builders: { total: number; free: number; regularTotal?: number };
  upgradeSlots?: {
    laboratory: { available: boolean; active?: number; total?: number } | null;
    petHouse: { available: boolean } | null;
    builderBase: { builders: { total: number; free: number }; laboratory: { available: boolean; active?: number; total?: number } | null } | null;
  };
  upgrades: Array<{ id: string; name: string; type: string; level: number; nextLevel: number; finishAt: string }>;
  unknownDataIds: number[]; account: { id: string; label: string; color: string } | null; isNew: boolean;
};

function parseNotificationOffsets(value: string): number[] {
  const offsets = [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean).map(Number))];
  if (offsets.some((item) => !Number.isInteger(item) || item < 0 || item > 525_600)) throw new Error("invalid notification offset");
  return offsets.sort((a, b) => b - a);
}

export default function AdminPanel({ apiBase, onChanged }: { apiBase: string; onChanged: () => void }) {
  const t = useTranslations("Admin");
  const { formatDateTime } = useDashboardFormat();
  const [token, setToken] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [notificationDrafts, setNotificationDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [section, setSection] = useState<"import" | "alerts" | "villages">("import");
  const [exportText, setExportText] = useState("");
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [editing, setEditing] = useState<Account | null>(null);
  const [accountForm, setAccountForm] = useState({ label: "", color: "#4c9a79", sourceUrl: "", apiKey: "" });

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`${apiBase}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers } });
    const result = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    if (response.status === 401) {
      localStorage.removeItem("multi-coc-admin-token");
      setToken("");
      throw new Error(t("invalidToken"));
    }
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    return result;
  }, [apiBase, t, token]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [accountResult, upgradeResult] = await Promise.all([request("/api/admin/accounts"), request("/api/admin/upgrades")]);
      setAccounts(accountResult.accounts); setUpgrades(upgradeResult.upgrades);
      setNotificationDrafts(Object.fromEntries(upgradeResult.upgrades.map((item: Upgrade) => [item.id, item.notificationOffsets.join(", ")]))); setError("");
    } catch (reason) { setError((reason as Error).message); }
  }, [request, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => setToken(localStorage.getItem("multi-coc-admin-token") || ""), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load, token]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    try { setError(""); const result = await action(); setMessage(success); await load(); onChanged(); return result; }
    catch (reason) { setMessage(""); setError((reason as Error).message); return null; }
  };

  const chooseAccount = (item: Account) => {
    setEditing(item);
    setAccountForm({ label: item.label, color: item.color, sourceUrl: item.sourceUrl, apiKey: "" });
  };

  if (!token) return <section className="admin-shell"><div className="admin-login"><p className="eyebrow">ADMIN</p><h1>{t("authentication")}</h1><p>{t("authenticationHelp")}</p>{error && <p className="admin-alert error">{error}</p>}<form onSubmit={(event) => { event.preventDefault(); const value = String(new FormData(event.currentTarget).get("token") || "").trim(); setError(""); setMessage(""); localStorage.setItem("multi-coc-admin-token", value); setToken(value); }}><input name="token" type="password" required autoComplete="current-password" autoFocus /><button>{t("signIn")}</button></form></div></section>;

  return <section className="admin-shell">
    <div className="admin-title"><div><p className="eyebrow">VILLAGE DATA</p><h1>{t("title")}</h1></div><button className="secondary" onClick={() => { localStorage.removeItem("multi-coc-admin-token"); setToken(""); }}>{t("signOut")}</button></div>
    <div className="admin-sections">
      <button className={section === "import" ? "active" : ""} onClick={() => setSection("import")}>{t("updateData")}</button>
      <button className={section === "alerts" ? "active" : ""} onClick={() => setSection("alerts")}>{t("upgradeAlerts")}</button>
      <button className={section === "villages" ? "active" : ""} onClick={() => setSection("villages")}>{t("manageVillages")}</button>
    </div>
    {error && <p className="admin-alert error">{error}</p>}{message && <p className="admin-alert">{message}</p>}

    {section === "import" && <div className="import-flow">
      <article className="admin-card export-card primary-card"><p className="step-label">01 · PASTE</p><h2>{t("pasteJson")}</h2><p>{t("pasteJsonHelp")}</p>
        <textarea value={exportText} onChange={(event) => { setExportText(event.target.value); setPreview(null); setMessage(""); setError(""); }} placeholder='{"tag":"#...","timestamp":...}' autoFocus />
        <button disabled={!exportText.trim()} onClick={async () => {
          try { setError(""); setMessage(""); setPreview(await request("/api/admin/village-export/preview", { method: "POST", body: JSON.stringify({ exportText }) })); }
          catch (reason) { setPreview(null); setError((reason as Error).message); }
        }}>{t("reviewData")}</button>
      </article>

      {preview && <article className="admin-card preview-card"><p className="step-label">02 · REVIEW</p><div className="preview-heading"><div><h2>{preview.account?.label || t("newVillage")}</h2><p>{preview.tag} · TH {preview.townHall} · {formatDateTime(preview.exportedAt)}</p></div><span className={preview.isNew ? "new-badge" : "match-badge"}>{preview.isNew ? t("newBadge") : t("matchedBadge")}</span></div>
        <div className="preview-stats compact"><div><span>{t("inProgress")}</span><b>{preview.upgrades.length}</b></div><div><span>{t("unknownItems")}</span><b>{preview.unknownDataIds.length}</b></div></div>
        <UpgradeAvailabilityPanel builders={preview.builders} upgradeSlots={preview.upgradeSlots} />
        {preview.isNew && <label className="new-label">{t("displayName")}<input required autoFocus value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder={t("displayNamePlaceholder")} /><small>{t("newVillageHelp")}</small></label>}
        <div className="preview-upgrades">{preview.upgrades.slice(0, 8).map((item) => <div key={item.id}><span><b>{item.name}</b><small>Lv. {item.level} → {item.nextLevel}</small></span><time>{formatDateTime(item.finishAt)}</time></div>)}{preview.upgrades.length > 8 && <p>+ {preview.upgrades.length - 8}</p>}</div>
        <div className="confirm-row"><button className="secondary" onClick={() => setPreview(null)}>{t("pasteAgain")}</button><button disabled={preview.isNew && !newLabel.trim()} onClick={async () => {
          const result = await run(() => request("/api/admin/village-export", { method: "POST", body: JSON.stringify({ exportText, label: newLabel }) }), preview.isNew ? t("villageAdded") : t("villageImported"));
          if (result) { setExportText(""); setPreview(null); setNewLabel(""); }
        }}>{preview.isNew ? t("addAndImport") : t("importVillage")}</button></div>
      </article>}
    </div>}

    {section === "alerts" && <article className="admin-card wide-card"><h2>{t("upgradeAlertsTitle")}</h2><p>{t("upgradeAlertsHelp")}</p>
      <div className="upgrade-admin-list">{upgrades.some((item) => item.status === "active") ? upgrades.filter((item) => item.status === "active").map((item) => <div key={item.id}><span><b>{accounts.find((a) => a.id === item.accountId)?.label} · {item.name}</b><small>{formatDateTime(item.finishAt)} · {t(item.source === "export" ? "source_export" : "source_snapshot")}</small></span><label className="notification-offsets"><small>{t("notificationMinutes")}</small><input value={notificationDrafts[item.id] ?? ""} onChange={(event) => setNotificationDrafts({ ...notificationDrafts, [item.id]: event.target.value })} placeholder="60, 1, 0" /></label><button onClick={() => run(() => request(`/api/admin/upgrades/${item.id}`, { method: "PATCH", body: JSON.stringify({ notificationOffsets: parseNotificationOffsets(notificationDrafts[item.id] || "") }) }), t("notificationsSaved"))}>{t("saveNotifications")}</button></div>) : <p>{t("noTrackedUpgrades")}</p>}</div>
    </article>}

    {section === "villages" && <div className="village-admin-layout"><article className="admin-card"><h2>{t("registeredVillages")}</h2><p>{t("registeredVillagesHelp")}</p><div className="admin-list village-picker">{accounts.map((item) => <button key={item.id} className={editing?.id === item.id ? "selected" : ""} onClick={() => chooseAccount(item)}><i style={{ background: item.color }} /><span><b>{item.label}</b><small>{item.playerTag}</small></span></button>)}{!accounts.length && <p>{t("noVillages")}</p>}</div></article>
      <article className="admin-card">{editing ? <><h2>{t("villageSettings")}</h2><p>{editing.playerTag}</p><form className="admin-form" onSubmit={(event) => { event.preventDefault(); run(async () => { await request(`/api/admin/accounts/${editing.id}`, { method: "PATCH", body: JSON.stringify(accountForm) }); setEditing(null); }, t("settingsSaved")); }}>
        <label>{t("displayName")}<input required value={accountForm.label} onChange={(e) => setAccountForm({ ...accountForm, label: e.target.value })} /></label><label>{t("color")}<input type="color" value={accountForm.color} onChange={(e) => setAccountForm({ ...accountForm, color: e.target.value })} /></label>
        <label className="wide">{t("sourceUrl")}<input value={accountForm.sourceUrl} onChange={(e) => setAccountForm({ ...accountForm, sourceUrl: e.target.value })} /></label>
        <label className="wide">{t("newIngestKey")}<input type="password" value={accountForm.apiKey} onChange={(e) => setAccountForm({ ...accountForm, apiKey: e.target.value })} /></label>
        <button className="wide">{t("saveSettings")}</button></form><button className="danger standalone-danger" onClick={() => confirm(t("deleteConfirm")) && run(async () => { await request(`/api/admin/accounts/${editing.id}`, { method: "DELETE" }); setEditing(null); }, t("deleted"))}>{t("deleteVillage")}</button></> : <div className="empty settings-empty">{t("chooseVillage")}</div>}</article></div>}
  </section>;
}

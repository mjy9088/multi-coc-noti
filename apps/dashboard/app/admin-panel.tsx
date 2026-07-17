"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import UpgradeAvailabilityPanel from "./upgrade-availability-panel";
import { useDashboardFormat } from "./use-dashboard-format";

type ResourceStatus = "abundant" | "sufficient" | "insufficient" | "unanswered";
type Account = { id: string; label: string; playerTag: string; color: string; tags: string[]; resourceStatus: ResourceStatus; resourceStatusUpdatedAt: string; resourcePreparationMinutes: number | null };
type Upgrade = { id: string; accountId: string; name: string; type: string; level: number; nextLevel: number; finishAt: string; status: string; source: "export" | "snapshot"; notificationOffsets: number[]; resourcePreparationOverrideMinutes: number | null };
type UpgradeAlertDraft = { mode: "inherit" | "disabled" | "custom"; minutes: number };
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
const adminLoadedAt = Date.now();
type AdminSection = "import" | "alerts" | "villages" | "groups";
type QuickPasteRequest = { id: number; text: string; clipboardError: boolean } | null;

export default function AdminPanel({ apiBase, onChanged, onSectionChange, onVillageChange, initialSection = "import", initialAccountId = null, quickPasteRequest = null }: { apiBase: string; onChanged: () => void; onSectionChange?: (section: AdminSection) => void; onVillageChange?: (accountId: string) => void; initialSection?: AdminSection; initialAccountId?: string | null; quickPasteRequest?: QuickPasteRequest }) {
  const t = useTranslations("Admin");
  const { formatDateTime, formatDuration } = useDashboardFormat();
  const [token, setToken] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [groupOrder, setGroupOrder] = useState<string[]>([]);
  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [upgradeAlertDrafts, setUpgradeAlertDrafts] = useState<Record<string, UpgradeAlertDraft>>({});
  const [savingUpgradeId, setSavingUpgradeId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [section, setSection] = useState<AdminSection>(initialSection);
  const [exportText, setExportText] = useState("");
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [clockNow, setClockNow] = useState(adminLoadedAt);
  const [newLabel, setNewLabel] = useState("");
  const [editing, setEditing] = useState<Account | null>(null);
  const [accountForm, setAccountForm] = useState({ label: "", color: "#4c9a79", tags: "", resourceStatus: "unanswered" as ResourceStatus, resourcePreparationEnabled: true, resourcePreparationMinutes: 60 });
  const [resourcePrompt, setResourcePrompt] = useState<{ accountId: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [resourceResponding, setResourceResponding] = useState(false);
  const reviewSequence = useRef(0);
  const reviewingText = useRef("");
  const lastReviewedText = useRef("");
  const initialAccountApplied = useRef(false);
  const appliedQuickPaste = useRef<number | null>(null);
  const confirmImportButton = useRef<HTMLButtonElement | null>(null);

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
      const [accountResult, upgradeResult, dashboardSettings] = await Promise.all([request("/api/admin/accounts"), request("/api/admin/upgrades"), request("/api/admin/dashboard-settings")]);
      setAccounts(accountResult.accounts); setUpgrades(upgradeResult.upgrades);
      setUpgradeAlertDrafts(Object.fromEntries(upgradeResult.upgrades.map((upgrade: Upgrade) => [upgrade.id, {
        mode: upgrade.resourcePreparationOverrideMinutes === null ? "inherit" : upgrade.resourcePreparationOverrideMinutes === 0 ? "disabled" : "custom",
        minutes: upgrade.resourcePreparationOverrideMinutes && upgrade.resourcePreparationOverrideMinutes > 0 ? upgrade.resourcePreparationOverrideMinutes : 60,
      }])));
      setEditing((current) => current ? accountResult.accounts.find((item: Account) => item.id === current.id) || null : null);
      if (!initialAccountApplied.current && initialAccountId) {
        const account = accountResult.accounts.find((item: Account) => item.id === initialAccountId);
        if (account) {
          setEditing(account);
          setAccountForm({ label: account.label, color: account.color, tags: (account.tags || []).join(", "), resourceStatus: account.resourceStatus, resourcePreparationEnabled: account.resourcePreparationMinutes != null, resourcePreparationMinutes: account.resourcePreparationMinutes || 60 });
        }
        initialAccountApplied.current = true;
      }
      setGroupOrder(dashboardSettings.groupOrder || []); setError("");
    } catch (reason) { setError((reason as Error).message); }
  }, [initialAccountId, request, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => setToken(localStorage.getItem("multi-coc-admin-token") || ""), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load, token]);
  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const reviewExport = useCallback(async (text: string) => {
    const candidate = text.trim();
    if (!candidate || reviewingText.current === candidate || lastReviewedText.current === candidate) return;
    const sequence = ++reviewSequence.current;
    reviewingText.current = candidate;
    setPreviewLoading(true); setError(""); setMessage("");
    try {
      const result = await request("/api/admin/village-export/preview", { method: "POST", body: JSON.stringify({ exportText: candidate }) });
      if (sequence !== reviewSequence.current) return;
      lastReviewedText.current = candidate;
      setPreview(result);
    } catch (reason) {
      if (sequence === reviewSequence.current) { setPreview(null); setError((reason as Error).message); }
    } finally {
      if (sequence === reviewSequence.current) setPreviewLoading(false);
      if (reviewingText.current === candidate) reviewingText.current = "";
    }
  }, [request]);

  const replaceExportText = useCallback((text: string) => {
    reviewSequence.current += 1;
    reviewingText.current = ""; lastReviewedText.current = "";
    setPreviewLoading(false); setExportText(text); setPreview(null); setNewLabel(""); setMessage(""); setError("");
  }, []);

  useEffect(() => {
    const candidate = exportText.trim();
    if (!candidate) return;
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed === null || typeof parsed !== "object") return;
    } catch { return; }
    const timer = window.setTimeout(() => reviewExport(candidate), 350);
    return () => window.clearTimeout(timer);
  }, [exportText, reviewExport]);

  useEffect(() => {
    if (!token || !quickPasteRequest || appliedQuickPaste.current === quickPasteRequest.id) return;
    const timer = window.setTimeout(() => {
      appliedQuickPaste.current = quickPasteRequest.id;
      setSection("import");
      onSectionChange?.("import");
      if (quickPasteRequest.text) replaceExportText(quickPasteRequest.text);
      else if (quickPasteRequest.clipboardError) setError(t("clipboardUnavailable"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [onSectionChange, quickPasteRequest, replaceExportText, t, token]);

  useEffect(() => {
    if (!preview || preview.isNew) return;
    const timer = window.setTimeout(() => {
      confirmImportButton.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      confirmImportButton.current?.focus({ preventScroll: true });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [preview]);

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) throw new Error("empty clipboard");
      replaceExportText(text);
    } catch { setError(t("clipboardUnavailable")); }
  };

  const run = async (action: () => Promise<unknown>, success: string) => {
    try { setError(""); const result = await action(); setMessage(success); await load(); onChanged(); return result; }
    catch (reason) { setMessage(""); setError((reason as Error).message); return null; }
  };

  const chooseAccount = (item: Account) => {
    setEditing(item);
    setAccountForm({ label: item.label, color: item.color, tags: (item.tags || []).join(", "), resourceStatus: item.resourceStatus, resourcePreparationEnabled: item.resourcePreparationMinutes != null, resourcePreparationMinutes: item.resourcePreparationMinutes || 60 });
    onVillageChange?.(item.id);
    if (window.matchMedia("(max-width: 760px)").matches) window.setTimeout(() => document.getElementById("village-settings-card")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const availableGroups = (() => {
    const labels = new Map<string, string>();
    for (const account of accounts) for (const tag of account.tags || []) if (!labels.has(tag.toLocaleLowerCase())) labels.set(tag.toLocaleLowerCase(), tag);
    const ordered = groupOrder.map((tag) => labels.get(tag.toLocaleLowerCase())).filter((tag): tag is string => Boolean(tag));
    const included = new Set(ordered.map((tag) => tag.toLocaleLowerCase()));
    return [...ordered, ...[...labels.values()].filter((tag) => !included.has(tag.toLocaleLowerCase())).sort((a, b) => a.localeCompare(b))];
  })();

  const moveGroup = async (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= availableGroups.length) return;
    const next = [...availableGroups];
    [next[index], next[target]] = [next[target], next[index]];
    setGroupOrder(next);
    await run(() => request("/api/admin/dashboard-settings", { method: "PATCH", body: JSON.stringify({ groupOrder: next }) }), t("groupOrderSaved"));
  };

  const submitImport = async () => {
    if (!preview || importing) return;
    const askForResources = preview.upgrades.length > 0;
    setImporting(true);
    const result = await run(() => request("/api/admin/village-export", { method: "POST", body: JSON.stringify({ exportText, label: newLabel }) }), preview.isNew ? t("villageAdded") : t("villageImported"));
    setImporting(false);
    if (result) {
      reviewSequence.current += 1; lastReviewedText.current = ""; setExportText(""); setPreview(null); setNewLabel("");
      if (askForResources) setResourcePrompt({ accountId: (result as { account: { id: string } }).account.id });
    }
  };

  const saveResourceResponse = async (resourceStatus: Exclude<ResourceStatus, "unanswered">) => {
    if (!resourcePrompt || resourceResponding) return;
    setResourceResponding(true);
    const result = await run(() => request(`/api/admin/accounts/${resourcePrompt.accountId}/resource-status`, { method: "PATCH", body: JSON.stringify({ resourceStatus }) }), t("resourceStatusSaved"));
    setResourceResponding(false);
    if (result) setResourcePrompt(null);
  };

  const saveUpgradeAlert = async (upgrade: Upgrade) => {
    const draft = upgradeAlertDrafts[upgrade.id] || { mode: "inherit", minutes: 60 };
    const override = draft.mode === "inherit" ? null : draft.mode === "disabled" ? 0 : draft.minutes;
    setSavingUpgradeId(upgrade.id);
    await run(() => request(`/api/admin/upgrades/${upgrade.id}/alerts`, { method: "PATCH", body: JSON.stringify({ resourcePreparationOverrideMinutes: override }) }), t("notificationsSaved"));
    setSavingUpgradeId(null);
  };

  const openVillageSettings = (account: Account | undefined) => {
    if (!account) return;
    chooseAccount(account); setSection("villages"); onSectionChange?.("villages");
    window.setTimeout(() => document.getElementById("village-settings-card")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  if (!token) return <section className="admin-shell"><div className="admin-login"><p className="eyebrow">ADMIN</p><h1>{t("authentication")}</h1><p>{t("authenticationHelp")}</p>{error && <p className="admin-alert error">{error}</p>}<form onSubmit={(event) => { event.preventDefault(); const value = String(new FormData(event.currentTarget).get("token") || "").trim(); setError(""); setMessage(""); localStorage.setItem("multi-coc-admin-token", value); setToken(value); }}><input name="token" type="password" required autoComplete="current-password" autoFocus /><button>{t("signIn")}</button></form></div></section>;

  return <section className="admin-shell">
    <div className="admin-title"><div><p className="eyebrow">VILLAGE DATA</p><h1>{t("title")}</h1></div><button className="secondary" onClick={() => { localStorage.removeItem("multi-coc-admin-token"); setToken(""); }}>{t("signOut")}</button></div>
    <div className="admin-sections section-tabs" role="navigation" aria-label={t("settingsSections")}>
      <button className={section === "import" ? "active" : ""} onClick={() => { setSection("import"); onSectionChange?.("import"); }}>{t("updateData")}</button>
      <button className={section === "alerts" ? "active" : ""} onClick={() => { setSection("alerts"); onSectionChange?.("alerts"); }}>{t("upgradeAlerts")}</button>
      <button className={section === "villages" ? "active" : ""} onClick={() => { setSection("villages"); onSectionChange?.("villages"); }}>{t("manageVillages")}</button>
      <button className={section === "groups" ? "active" : ""} onClick={() => { setSection("groups"); onSectionChange?.("groups"); }}>{t("manageGroups")}</button>
    </div>
    {error && <p className="admin-alert error">{error}</p>}{message && <p className="admin-alert">{message}</p>}

    {section === "import" && <div className="import-flow">
      <article className="admin-card export-card primary-card"><p className="step-label">01 · PASTE</p><h2>{t("pasteJson")}</h2><p>{t("pasteJsonHelp")}</p>
        <textarea value={exportText} onChange={(event) => replaceExportText(event.target.value)} placeholder='{"tag":"#...","timestamp":...}' autoFocus spellCheck={false} autoCapitalize="off" aria-busy={previewLoading} />
        <div className="review-action" aria-live="polite"><small>{previewLoading ? t("reviewingData") : t("autoReviewHelp")}</small><span><button type="button" className="secondary" onClick={pasteFromClipboard}>{t("pasteClipboard")}</button><button type="button" disabled={!exportText.trim() || previewLoading} onClick={() => reviewExport(exportText)}>{previewLoading ? t("reviewingData") : t("reviewData")}</button></span></div>
      </article>

      {preview && <article className="admin-card preview-card"><p className="step-label">02 · REVIEW</p><div className="preview-heading"><div><h2>{preview.account?.label || t("newVillage")}</h2><p>{preview.tag} · TH {preview.townHall} · {formatDateTime(preview.exportedAt)}</p></div><span className={preview.isNew ? "new-badge" : "match-badge"}>{preview.isNew ? t("newBadge") : t("matchedBadge")}</span></div>
        <div className="preview-stats compact"><div><span>{t("inProgress")}</span><b>{preview.upgrades.length}</b></div><div><span>{t("unknownItems")}</span><b>{preview.unknownDataIds.length}</b></div></div>
        <UpgradeAvailabilityPanel builders={preview.builders} upgradeSlots={preview.upgradeSlots} />
        {preview.isNew && <label className="new-label">{t("displayName")}<input required autoFocus value={newLabel} onChange={(event) => setNewLabel(event.target.value)} placeholder={t("displayNamePlaceholder")} /><small>{t("newVillageHelp")}</small></label>}
        <div className="preview-upgrades">{preview.upgrades.slice(0, 8).map((item) => <div key={item.id}><span><b>{item.name}</b><small>Lv. {item.level} → {item.nextLevel}</small></span><time>{formatDateTime(item.finishAt)}<small>{t("remainingTime", { time: formatDuration(item.finishAt, clockNow) })}</small></time></div>)}{preview.upgrades.length > 8 && <p>+ {preview.upgrades.length - 8}</p>}</div>
        <div className="confirm-row"><button className="secondary" onClick={() => setPreview(null)}>{t("pasteAgain")}</button><button ref={confirmImportButton} disabled={importing || (preview.isNew && !newLabel.trim())} onClick={submitImport}>{preview.isNew ? t("addAndImport") : t("importVillage")}</button></div>
      </article>}
    </div>}

    {section === "alerts" && <article className="admin-card wide-card"><h2>{t("upgradeAlertsTitle")}</h2><p>{t("upgradeAlertsHelp")}</p>
      <div className="upgrade-admin-list">{upgrades.some((item) => item.status === "active") ? upgrades.filter((item) => item.status === "active").map((item) => { const account = accounts.find((a) => a.id === item.accountId); const draft = upgradeAlertDrafts[item.id] || { mode: "inherit", minutes: 60 }; return <div className="upgrade-alert-row" key={item.id}><div className="upgrade-alert-heading"><span><b>{account?.label} · {item.name}</b><small>{formatDateTime(item.finishAt)} · {t("remainingTime", { time: formatDuration(item.finishAt, clockNow) })} · {t(item.source === "export" ? "source_export" : "source_snapshot")}</small></span><span className="policy-badge">{t(`resourcePolicy_${account?.resourceStatus || "unanswered"}`)}</span></div><div className="upgrade-alert-controls"><label>{t("preparationAlertSetting")}<select value={draft.mode} onChange={(event) => setUpgradeAlertDrafts({ ...upgradeAlertDrafts, [item.id]: { ...draft, mode: event.target.value as UpgradeAlertDraft["mode"] } })}><option value="inherit">{t("preparationInherit", { minutes: account?.resourcePreparationMinutes ?? t("disabled") })}</option><option value="disabled">{t("preparationDisabled")}</option><option value="custom">{t("preparationCustom")}</option></select></label>{draft.mode === "custom" && <label>{t("resourcePreparationMinutes")}<input type="number" min="1" max="525600" required value={draft.minutes} onChange={(event) => setUpgradeAlertDrafts({ ...upgradeAlertDrafts, [item.id]: { ...draft, minutes: Number(event.target.value) } })} /></label>}<div className="upgrade-alert-actions"><button type="button" className="secondary" onClick={() => openVillageSettings(account)}>{t("goToVillageSettings")}</button><button type="button" disabled={savingUpgradeId === item.id || (draft.mode === "custom" && (!Number.isInteger(draft.minutes) || draft.minutes < 1 || draft.minutes > 525600))} onClick={() => saveUpgradeAlert(item)}>{savingUpgradeId === item.id ? t("saving") : t("saveNotifications")}</button></div></div></div>; }) : <p>{t("noTrackedUpgrades")}</p>}</div>
    </article>}

    {section === "villages" && <div className="village-admin-layout"><article className="admin-card village-list-card"><h2>{t("registeredVillages")}</h2><p>{t("registeredVillagesHelp")}</p><div className="admin-list village-picker">{accounts.map((item) => <button key={item.id} className={editing?.id === item.id ? "selected" : ""} onClick={() => chooseAccount(item)}><i style={{ background: item.color }} /><span><b>{item.label}</b><small>{item.playerTag}{item.tags?.length ? ` · ${item.tags.map((tag) => `#${tag}`).join(" ")}` : ""}</small></span></button>)}{!accounts.length && <p>{t("noVillages")}</p>}</div></article>
      <article className="admin-card village-settings-card" id="village-settings-card">{editing ? <><h2>{t("villageSettings")}</h2><p>{editing.playerTag}</p><form className="admin-form" onSubmit={(event) => { event.preventDefault(); run(() => request(`/api/admin/accounts/${editing.id}`, { method: "PATCH", body: JSON.stringify({ ...accountForm, resourcePreparationMinutes: accountForm.resourcePreparationEnabled ? accountForm.resourcePreparationMinutes : null }) }), t("settingsSaved")); }}>
        <label>{t("displayName")}<input required value={accountForm.label} onChange={(e) => setAccountForm({ ...accountForm, label: e.target.value })} /></label><label>{t("color")}<input type="color" value={accountForm.color} onChange={(e) => setAccountForm({ ...accountForm, color: e.target.value })} /></label>
        <label className="wide">{t("accountTags")}<input value={accountForm.tags} onChange={(e) => setAccountForm({ ...accountForm, tags: e.target.value })} placeholder={t("accountTagsPlaceholder")} /><small>{t("accountTagsHelp")}</small></label>
        <label className="wide">{t("resourceStatus")}<select value={accountForm.resourceStatus} onChange={(e) => setAccountForm({ ...accountForm, resourceStatus: e.target.value as ResourceStatus })}><option value="abundant">{t("resourceAbundant")}</option><option value="sufficient">{t("resourceSufficient")}</option><option value="insufficient">{t("resourceInsufficient")}</option><option value="unanswered">{t("resourceUnanswered")}</option></select><small>{t("resourceStatusHelp")}</small></label>
        <label className="wide check-label"><input type="checkbox" checked={accountForm.resourcePreparationEnabled} onChange={(e) => setAccountForm({ ...accountForm, resourcePreparationEnabled: e.target.checked })} />{t("resourcePreparationEnabled")}</label>
        {accountForm.resourcePreparationEnabled && <label className="wide">{t("resourcePreparationMinutes")}<input type="number" min="1" max="525600" required value={accountForm.resourcePreparationMinutes} onChange={(e) => setAccountForm({ ...accountForm, resourcePreparationMinutes: Number(e.target.value) })} /></label>}
        <button className="wide">{t("saveSettings")}</button></form><button className="danger standalone-danger" onClick={() => confirm(t("deleteConfirm")) && run(async () => { await request(`/api/admin/accounts/${editing.id}`, { method: "DELETE" }); setEditing(null); }, t("deleted"))}>{t("deleteVillage")}</button></> : <div className="empty settings-empty">{t("chooseVillage")}</div>}</article></div>}

    {section === "groups" && <article className="admin-card group-order-card"><h2>{t("groupOrder")}</h2><p>{t("groupOrderHelp")}</p><div className="group-order-settings standalone-group-order">{availableGroups.map((tag, index) => <div key={tag}><span>#{tag}</span><span><button type="button" className="secondary" disabled={index === 0} onClick={() => moveGroup(index, -1)} aria-label={t("moveGroupUp", { tag })}>↑</button><button type="button" className="secondary" disabled={index === availableGroups.length - 1} onClick={() => moveGroup(index, 1)} aria-label={t("moveGroupDown", { tag })}>↓</button></span></div>)}{!availableGroups.length && <small>{t("noGroups")}</small>}</div></article>}
    {resourcePrompt && <div className="resource-prompt-backdrop" role="presentation" onClick={() => setResourcePrompt(null)}><div className="resource-prompt" role="dialog" aria-modal="true" aria-labelledby="resource-prompt-title" onClick={(event) => event.stopPropagation()}><h2 id="resource-prompt-title">{t("resourcePromptTitle")}</h2><p>{t("resourcePromptHelp")}</p><div><button disabled={resourceResponding} onClick={() => saveResourceResponse("abundant")}>{t("resourceAbundant")}</button><button disabled={resourceResponding} onClick={() => saveResourceResponse("sufficient")}>{t("resourceSufficient")}</button><button disabled={resourceResponding} onClick={() => saveResourceResponse("insufficient")}>{t("resourceInsufficient")}</button></div><button className="secondary" disabled={resourceResponding} onClick={() => setResourcePrompt(null)}>{t("resourceAnswerLater")}</button></div></div>}
  </section>;
}

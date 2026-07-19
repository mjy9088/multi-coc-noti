"use client";

import {
  ActionBar,
  Button,
  Checkbox,
  Description,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Field,
  Input,
  Label,
  Select,
  SplitLayout,
  StickyRouteFrame,
  StickyStackItem,
  Tab,
  Tabs,
  Textarea,
  useToast,
} from "@multi-coc/ui";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorState, LoadingState } from "./request-state";
import UpgradeAvailabilityPanel from "./upgrade-availability-panel";
import { useAdminRequest } from "./use-admin-request";
import { useDashboardFormat } from "./use-dashboard-format";
import { useMutationFeedback } from "./use-mutation-feedback";

type ResourceStatus = "abundant" | "sufficient" | "insufficient" | "unanswered";
type Account = {
  id: string;
  label: string;
  playerTag: string;
  color: string;
  tags: string[];
  resourceStatus: ResourceStatus;
  resourceStatusUpdatedAt: string;
  resourcePreparationMinutes: number | null;
};
type Upgrade = {
  id: string;
  accountId: string;
  name: string;
  type: string;
  level: number;
  nextLevel: number;
  finishAt: string;
  status: string;
  source: "export";
  notificationOffsets: number[];
  resourcePreparationOverrideMinutes: number | null;
};
type UpgradeAlertDraft = { mode: "inherit" | "disabled" | "custom"; minutes: number };
type ExportPreview = {
  tag: string;
  exportedAt: string;
  townHall: number;
  builders: { total: number; free: number; regularTotal?: number };
  upgradeSlots?: {
    laboratory: { available: boolean; active?: number; total?: number } | null;
    petHouse: { available: boolean } | null;
    builderBase: {
      builders: { total: number; free: number };
      laboratory: { available: boolean; active?: number; total?: number } | null;
    } | null;
  };
  upgrades: Array<{ id: string; name: string; type: string; level: number; nextLevel: number; finishAt: string }>;
  unknownDataIds: number[];
  account: { id: string; label: string; color: string } | null;
  isNew: boolean;
  changes: {
    hasPrevious: boolean;
    started: Array<{ id: string; name: string; type: string; base: string; level: number; nextLevel: number }>;
    ended: Array<{ id: string; name: string; type: string; base: string; level: number; nextLevel: number }>;
    slots: Array<{
      slot: "homeBuilders" | "homeLaboratory" | "petHouse" | "builderBuilders" | "builderLaboratory";
      before: number | boolean | null;
      after: number | boolean | null;
    }>;
  };
};
const adminLoadedAt = Date.now();
type AdminSection = "import" | "alerts" | "villages" | "groups";
type QuickPasteRequest = { id: number; text: string; clipboardError: boolean } | null;

export default function AdminPanel({
  apiBase,
  onChanged,
  onSectionChange,
  onVillageChange,
  initialSection = "import",
  initialAccountId = null,
  quickPasteRequest = null,
  onQuickPasteApplied,
}: {
  apiBase: string;
  onChanged: () => void;
  onSectionChange?: (section: AdminSection) => void;
  onVillageChange?: (accountId: string) => void;
  initialSection?: AdminSection;
  initialAccountId?: string | null;
  quickPasteRequest?: QuickPasteRequest;
  onQuickPasteApplied?: (id: number) => void;
}) {
  const t = useTranslations("Admin");
  const { dismiss, toast } = useToast();
  const { formatDateTime, formatDuration } = useDashboardFormat();
  const [token, setToken] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [groupOrder, setGroupOrder] = useState<string[]>([]);
  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [upgradeAlertDrafts, setUpgradeAlertDrafts] = useState<Record<string, UpgradeAlertDraft>>({});
  const [savingUpgradeId, setSavingUpgradeId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [initialLoading, setInitialLoading] = useState(false);
  const [initialLoadFailed, setInitialLoadFailed] = useState(false);
  const [message, setMessage] = useState("");
  const section = initialSection;
  const [exportText, setExportText] = useState("");
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [clockNow, setClockNow] = useState(adminLoadedAt);
  const [newLabel, setNewLabel] = useState("");
  const [villageSearch, setVillageSearch] = useState("");
  const [editing, setEditing] = useState<Account | null>(null);
  const [accountForm, setAccountForm] = useState({
    label: "",
    color: "#4c9a79",
    tags: "",
    resourceStatus: "unanswered" as ResourceStatus,
    resourcePreparationEnabled: true,
    resourcePreparationMinutes: 60,
  });
  const [resourcePrompt, setResourcePrompt] = useState<{ accountId: string } | null>(null);
  const [deletePromptOpen, setDeletePromptOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resourceResponding, setResourceResponding] = useState(false);
  const reviewSequence = useRef(0);
  const reviewingText = useRef("");
  const lastReviewedText = useRef("");
  const appliedQuickPaste = useRef<number | null>(null);
  const confirmImportButton = useRef<HTMLButtonElement | null>(null);

  const handleUnauthorized = useCallback(() => {
    localStorage.removeItem("multi-coc-admin-token");
    setToken("");
  }, []);
  const request = useAdminRequest(apiBase, token, t("invalidToken"), handleUnauthorized);

  const load = useCallback(async () => {
    if (!token) return;
    setInitialLoading(true);
    try {
      const [accountResult, upgradeResult, dashboardSettings] = await Promise.all([
        request("/api/admin/accounts"),
        request("/api/admin/upgrades"),
        request("/api/admin/dashboard-settings"),
      ]);
      setAccounts(accountResult.accounts);
      setUpgrades(upgradeResult.upgrades);
      setUpgradeAlertDrafts(
        Object.fromEntries(
          upgradeResult.upgrades.map((upgrade: Upgrade) => [
            upgrade.id,
            {
              mode:
                upgrade.resourcePreparationOverrideMinutes === null
                  ? "inherit"
                  : upgrade.resourcePreparationOverrideMinutes === 0
                    ? "disabled"
                    : "custom",
              minutes:
                upgrade.resourcePreparationOverrideMinutes && upgrade.resourcePreparationOverrideMinutes > 0
                  ? upgrade.resourcePreparationOverrideMinutes
                  : 60,
            },
          ]),
        ),
      );
      setEditing((current) =>
        current ? accountResult.accounts.find((item: Account) => item.id === current.id) || null : null,
      );
      setGroupOrder(dashboardSettings.groupOrder || []);
      setError("");
      setInitialLoadFailed(false);
    } catch (reason) {
      setError((reason as Error).message);
      setInitialLoadFailed(true);
    } finally {
      setInitialLoading(false);
    }
  }, [request, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setToken(localStorage.getItem("multi-coc-admin-token") || "");
      setAuthReady(true);
    }, 0);
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
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 4_500);
    return () => window.clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!initialAccountId) {
        setEditing(null);
        return;
      }
      const account = accounts.find((item) => item.id === initialAccountId);
      if (!account) return;
      setEditing(account);
      setAccountForm({
        label: account.label,
        color: account.color,
        tags: (account.tags || []).join(", "),
        resourceStatus: account.resourceStatus,
        resourcePreparationEnabled: account.resourcePreparationMinutes != null,
        resourcePreparationMinutes: account.resourcePreparationMinutes || 60,
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [accounts, initialAccountId]);
  useEffect(() => {
    const id = "admin-mutation-feedback";
    if (!token || initialLoadFailed) {
      dismiss(id);
      return;
    }
    if (error) {
      toast({ id, intent: "error", title: error, duration: null });
      return;
    }
    if (message) {
      toast({ id, intent: "success", title: message });
      return;
    }
    dismiss(id);
  }, [dismiss, error, initialLoadFailed, message, toast, token]);

  const reviewExport = useCallback(
    async (text: string) => {
      const candidate = text.trim();
      if (!candidate || reviewingText.current === candidate || lastReviewedText.current === candidate) return;
      const sequence = ++reviewSequence.current;
      reviewingText.current = candidate;
      setPreviewLoading(true);
      setError("");
      setMessage("");
      try {
        const result = await request("/api/admin/village-export/preview", {
          method: "POST",
          body: JSON.stringify({ exportText: candidate }),
        });
        if (sequence !== reviewSequence.current) return;
        lastReviewedText.current = candidate;
        setPreview(result);
      } catch (reason) {
        if (sequence === reviewSequence.current) {
          setPreview(null);
          setError((reason as Error).message);
        }
      } finally {
        if (sequence === reviewSequence.current) setPreviewLoading(false);
        if (reviewingText.current === candidate) reviewingText.current = "";
      }
    },
    [request],
  );

  const replaceExportText = useCallback((text: string) => {
    reviewSequence.current += 1;
    reviewingText.current = "";
    lastReviewedText.current = "";
    setPreviewLoading(false);
    setExportText(text);
    setPreview(null);
    setNewLabel("");
    setMessage("");
    setError("");
  }, []);

  useEffect(() => {
    const candidate = exportText.trim();
    if (!candidate) return;
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed === null || typeof parsed !== "object") return;
    } catch {
      return;
    }
    const timer = window.setTimeout(() => reviewExport(candidate), 350);
    return () => window.clearTimeout(timer);
  }, [exportText, reviewExport]);

  useEffect(() => {
    if (!token || !quickPasteRequest || appliedQuickPaste.current === quickPasteRequest.id) return;
    const timer = window.setTimeout(() => {
      appliedQuickPaste.current = quickPasteRequest.id;
      onQuickPasteApplied?.(quickPasteRequest.id);
      onSectionChange?.("import");
      if (quickPasteRequest.text) replaceExportText(quickPasteRequest.text);
      else if (quickPasteRequest.clipboardError) setError(t("clipboardUnavailable"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [onQuickPasteApplied, onSectionChange, quickPasteRequest, replaceExportText, t, token]);

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
    } catch {
      setError(t("clipboardUnavailable"));
    }
  };

  const { mutationPending, run } = useMutationFeedback({ refresh: load, onChanged, setError, setMessage });

  const chooseAccount = (item: Account) => {
    setEditing(item);
    setAccountForm({
      label: item.label,
      color: item.color,
      tags: (item.tags || []).join(", "),
      resourceStatus: item.resourceStatus,
      resourcePreparationEnabled: item.resourcePreparationMinutes != null,
      resourcePreparationMinutes: item.resourcePreparationMinutes || 60,
    });
    onVillageChange?.(item.id);
  };

  const availableGroups = (() => {
    const labels = new Map<string, string>();
    for (const account of accounts)
      for (const tag of account.tags || [])
        if (!labels.has(tag.toLocaleLowerCase())) labels.set(tag.toLocaleLowerCase(), tag);
    const ordered = groupOrder
      .map((tag) => labels.get(tag.toLocaleLowerCase()))
      .filter((tag): tag is string => Boolean(tag));
    const included = new Set(ordered.map((tag) => tag.toLocaleLowerCase()));
    return [
      ...ordered,
      ...[...labels.values()]
        .filter((tag) => !included.has(tag.toLocaleLowerCase()))
        .sort((a, b) => a.localeCompare(b)),
    ];
  })();
  const normalizedVillageSearch = villageSearch.trim().toLocaleLowerCase();
  const visibleAccounts = normalizedVillageSearch
    ? accounts.filter((account) =>
        [account.label, account.playerTag, ...(account.tags || [])].some((value) =>
          value.toLocaleLowerCase().includes(normalizedVillageSearch),
        ),
      )
    : accounts;

  const moveGroup = async (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= availableGroups.length) return;
    const next = [...availableGroups];
    [next[index], next[target]] = [next[target], next[index]];
    setGroupOrder(next);
    await run(
      () => request("/api/admin/dashboard-settings", { method: "PATCH", body: JSON.stringify({ groupOrder: next }) }),
      t("groupOrderSaved"),
    );
  };

  const submitImport = async () => {
    if (!preview || importing) return;
    const askForResources = preview.upgrades.length > 0;
    setImporting(true);
    const result = await run(
      () =>
        request("/api/admin/village-export", { method: "POST", body: JSON.stringify({ exportText, label: newLabel }) }),
      preview.isNew ? t("villageAdded") : t("villageImported"),
    );
    setImporting(false);
    if (result) {
      reviewSequence.current += 1;
      lastReviewedText.current = "";
      setExportText("");
      setPreview(null);
      setNewLabel("");
      if (askForResources) setResourcePrompt({ accountId: (result as { account: { id: string } }).account.id });
    }
  };

  const saveResourceResponse = async (resourceStatus: Exclude<ResourceStatus, "unanswered">) => {
    if (!resourcePrompt || resourceResponding) return;
    setResourceResponding(true);
    const result = await run(
      () =>
        request(`/api/admin/accounts/${resourcePrompt.accountId}/resource-status`, {
          method: "PATCH",
          body: JSON.stringify({ resourceStatus }),
        }),
      t("resourceStatusSaved"),
    );
    setResourceResponding(false);
    if (result) setResourcePrompt(null);
  };

  const saveUpgradeAlert = async (upgrade: Upgrade) => {
    const draft = upgradeAlertDrafts[upgrade.id] || { mode: "inherit", minutes: 60 };
    const override = draft.mode === "inherit" ? null : draft.mode === "disabled" ? 0 : draft.minutes;
    setSavingUpgradeId(upgrade.id);
    await run(
      () =>
        request(`/api/admin/upgrades/${upgrade.id}/alerts`, {
          method: "PATCH",
          body: JSON.stringify({ resourcePreparationOverrideMinutes: override }),
        }),
      t("notificationsSaved"),
    );
    setSavingUpgradeId(null);
  };

  const openVillageSettings = (account: Account | undefined) => {
    if (!account) return;
    chooseAccount(account);
    onSectionChange?.("villages");
  };

  if (!authReady)
    return (
      <section className="settings-page">
        <LoadingState compact />
      </section>
    );
  if (!token)
    return (
      <section className="settings-page">
        <div className="settings-login settings-surface">
          <p className="settings-eyebrow">ADMIN</p>
          <h1>{t("authentication")}</h1>
          <p>{t("authenticationHelp")}</p>
          {error && <p className="settings-inline-error">{error}</p>}
          <form
            className="settings-login-form"
            onSubmit={(event) => {
              event.preventDefault();
              const value = String(new FormData(event.currentTarget).get("token") || "").trim();
              setError("");
              setMessage("");
              localStorage.setItem("multi-coc-admin-token", value);
              setToken(value);
            }}
          >
            <Field>
              <Label className="ui-visually-hidden">{t("authentication")}</Label>
              <Input name="token" type="password" required autoComplete="current-password" autoFocus />
            </Field>
            <Button>{t("signIn")}</Button>
          </form>
        </div>
      </section>
    );
  if (initialLoading && !accounts.length)
    return (
      <section className="settings-page">
        <LoadingState compact />
      </section>
    );
  if (initialLoadFailed && !accounts.length)
    return (
      <section className="settings-page">
        <ErrorState compact message={error} retry={() => void load()} />
      </section>
    );

  return (
    <section className="settings-page">
      <div className="settings-page-header">
        <div>
          <p className="settings-eyebrow">VILLAGE DATA</p>
          <h1>{t("title")}</h1>
        </div>
        <Button
          tone="secondary"
          onClick={() => {
            localStorage.removeItem("multi-coc-admin-token");
            setToken("");
          }}
        >
          {t("signOut")}
        </Button>
      </div>
      <StickyStackItem order={10} className="settings-tabs-sticky ui-sticky-surface">
        <Tabs
          className="settings-tabs"
          label={t("settingsSections")}
          value={section}
          onValueChange={(value) => {
            const next = value as AdminSection;
            onSectionChange?.(next);
          }}
        >
          <Tab value="import">{t("updateData")}</Tab>
          <Tab value="alerts">{t("upgradeAlerts")}</Tab>
          <Tab value="villages">{t("manageVillages")}</Tab>
          <Tab value="groups">{t("manageGroups")}</Tab>
        </Tabs>
      </StickyStackItem>
      <StickyRouteFrame className="settings-route-frame" scrollKey={section}>
        {section === "import" && (
          <div className="settings-import-flow">
            <article
              className={`settings-surface settings-export settings-step ${preview ? "step-complete" : "step-current"}`}
              aria-current={!preview ? "step" : undefined}
            >
              <p className="settings-step-label" data-step-state={preview ? t("stepDone") : t("stepNow")}>
                01 · PASTE
              </p>
              <h2>{t("pasteJson")}</h2>
              <p>{t("pasteJsonHelp")}</p>
              <Field>
                <Label className="ui-visually-hidden">{t("pasteJson")}</Label>
                <Textarea
                  value={exportText}
                  onChange={(event) => replaceExportText(event.target.value)}
                  placeholder='{"tag":"#...","timestamp":...}'
                  autoFocus
                  spellCheck={false}
                  autoCapitalize="off"
                  aria-busy={previewLoading}
                />
              </Field>
              <div className="settings-review-action" aria-live="polite">
                <small>{previewLoading ? t("reviewingData") : t("autoReviewHelp")}</small>
                <span>
                  <Button type="button" tone="secondary" onClick={pasteFromClipboard}>
                    {t("pasteClipboard")}
                  </Button>
                  <Button
                    type="button"
                    disabled={!exportText.trim() || previewLoading}
                    pending={previewLoading}
                    onClick={() => reviewExport(exportText)}
                  >
                    {previewLoading ? t("reviewingData") : t("reviewData")}
                  </Button>
                </span>
              </div>
            </article>

            {preview && (
              <article className="settings-surface settings-preview settings-step step-current" aria-current="step">
                <p className="settings-step-label" data-step-state={t("stepNow")}>
                  02 · REVIEW
                </p>
                <div className="settings-preview-heading">
                  <div>
                    <h2>{preview.account?.label || t("newVillage")}</h2>
                    <p>
                      {preview.tag} · TH {preview.townHall} · {formatDateTime(preview.exportedAt)}
                    </p>
                  </div>
                  <span className={preview.isNew ? "settings-new-badge" : "settings-match-badge"}>
                    {preview.isNew ? t("newBadge") : t("matchedBadge")}
                  </span>
                </div>
                <section className="settings-preview-changes" aria-live="polite">
                  <h3>{t("changesTitle")}</h3>
                  {!preview.changes.hasPrevious ? (
                    <p>{t("changesFirstExport")}</p>
                  ) : !preview.changes.started.length &&
                    !preview.changes.ended.length &&
                    !preview.changes.slots.length ? (
                    <p>{t("changesNone")}</p>
                  ) : (
                    <>
                      {!!preview.changes.started.length && (
                        <div className="settings-change-group started">
                          <b>{t("changesStarted")}</b>
                          {preview.changes.started.map((item) => (
                            <span key={item.id}>
                              + {item.name}{" "}
                              <small>
                                Lv. {item.level} → {item.nextLevel}
                              </small>
                            </span>
                          ))}
                        </div>
                      )}
                      {!!preview.changes.ended.length && (
                        <div className="settings-change-group ended">
                          <b>{t("changesEnded")}</b>
                          {preview.changes.ended.map((item) => (
                            <span key={item.id}>
                              − {item.name}{" "}
                              <small>
                                Lv. {item.level} → {item.nextLevel}
                              </small>
                            </span>
                          ))}
                        </div>
                      )}
                      {!!preview.changes.slots.length && (
                        <div className="settings-change-group slots">
                          <b>{t("changesSlots")}</b>
                          {preview.changes.slots.map((item) => (
                            <span key={item.slot}>
                              {t(`changeSlot_${item.slot}`)}{" "}
                              <small>
                                {t("changeValue", {
                                  before:
                                    typeof item.before === "boolean"
                                      ? t(item.before ? "available" : "busy")
                                      : (item.before ?? "—"),
                                  after:
                                    typeof item.after === "boolean"
                                      ? t(item.after ? "available" : "busy")
                                      : (item.after ?? "—"),
                                })}
                              </small>
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </section>
                <div className="settings-preview-stats">
                  <div>
                    <span>{t("inProgress")}</span>
                    <b>{preview.upgrades.length}</b>
                  </div>
                  <div>
                    <span>{t("unknownItems")}</span>
                    <b>{preview.unknownDataIds.length}</b>
                  </div>
                </div>
                <UpgradeAvailabilityPanel builders={preview.builders} upgradeSlots={preview.upgradeSlots} />
                {preview.isNew && (
                  <Field className="settings-new-label">
                    <Label>{t("displayName")}</Label>
                    <Input
                      required
                      autoFocus
                      value={newLabel}
                      onChange={(event) => setNewLabel(event.target.value)}
                      placeholder={t("displayNamePlaceholder")}
                    />
                    <Description>{t("newVillageHelp")}</Description>
                  </Field>
                )}
                <div className="settings-preview-upgrades">
                  {preview.upgrades.slice(0, 8).map((item) => (
                    <div key={item.id}>
                      <span>
                        <b>{item.name}</b>
                        <small>
                          Lv. {item.level} → {item.nextLevel}
                        </small>
                      </span>
                      <time>
                        {formatDateTime(item.finishAt)}
                        <small>{t("remainingTime", { time: formatDuration(item.finishAt, clockNow) })}</small>
                      </time>
                    </div>
                  ))}
                  {preview.upgrades.length > 8 && <p>+ {preview.upgrades.length - 8}</p>}
                </div>
                <div className="settings-confirm-row">
                  <Button tone="secondary" onClick={() => setPreview(null)}>
                    {t("pasteAgain")}
                  </Button>
                  <Button
                    ref={confirmImportButton}
                    disabled={importing || (preview.isNew && !newLabel.trim())}
                    pending={importing}
                    onClick={submitImport}
                  >
                    {preview.isNew ? t("addAndImport") : t("importVillage")}
                  </Button>
                </div>
              </article>
            )}
          </div>
        )}

        {section === "alerts" && (
          <article className="settings-surface settings-wide">
            <h2>{t("upgradeAlertsTitle")}</h2>
            <p>{t("upgradeAlertsHelp")}</p>
            <div className="settings-upgrade-list">
              {upgrades.some((item) => item.status === "active") ? (
                upgrades
                  .filter((item) => item.status === "active")
                  .map((item) => {
                    const account = accounts.find((a) => a.id === item.accountId);
                    const draft = upgradeAlertDrafts[item.id] || { mode: "inherit", minutes: 60 };
                    return (
                      <div className="settings-upgrade-row" key={item.id}>
                        <div className="settings-upgrade-heading">
                          <span>
                            <b>
                              {account?.label} · {item.name}
                            </b>
                            <small>
                              {formatDateTime(item.finishAt)} ·{" "}
                              {t("remainingTime", { time: formatDuration(item.finishAt, clockNow) })} ·{" "}
                              {t("source_export")}
                            </small>
                          </span>
                          <span className="settings-policy-badge">
                            {t(`resourcePolicy_${account?.resourceStatus || "unanswered"}`)}
                          </span>
                        </div>
                        <div className="settings-upgrade-controls">
                          <Field>
                            <Label>{t("preparationAlertSetting")}</Label>
                            <Select
                              value={draft.mode}
                              onChange={(event) =>
                                setUpgradeAlertDrafts({
                                  ...upgradeAlertDrafts,
                                  [item.id]: { ...draft, mode: event.target.value as UpgradeAlertDraft["mode"] },
                                })
                              }
                            >
                              <option value="inherit">
                                {t("preparationInherit", {
                                  minutes: account?.resourcePreparationMinutes ?? t("disabled"),
                                })}
                              </option>
                              <option value="disabled">{t("preparationDisabled")}</option>
                              <option value="custom">{t("preparationCustom")}</option>
                            </Select>
                          </Field>
                          {draft.mode === "custom" && (
                            <Field>
                              <Label>{t("resourcePreparationMinutes")}</Label>
                              <Input
                                type="number"
                                min="1"
                                max="525600"
                                required
                                value={draft.minutes}
                                onChange={(event) =>
                                  setUpgradeAlertDrafts({
                                    ...upgradeAlertDrafts,
                                    [item.id]: { ...draft, minutes: Number(event.target.value) },
                                  })
                                }
                              />
                            </Field>
                          )}
                          <div className="settings-upgrade-actions">
                            <Button type="button" tone="secondary" onClick={() => openVillageSettings(account)}>
                              {t("goToVillageSettings")}
                            </Button>
                            <Button
                              type="button"
                              pending={savingUpgradeId === item.id}
                              disabled={
                                savingUpgradeId === item.id ||
                                (draft.mode === "custom" &&
                                  (!Number.isInteger(draft.minutes) || draft.minutes < 1 || draft.minutes > 525600))
                              }
                              onClick={() => saveUpgradeAlert(item)}
                            >
                              {savingUpgradeId === item.id ? t("saving") : t("saveNotifications")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <p>{t("noTrackedUpgrades")}</p>
              )}
            </div>
          </article>
        )}

        {section === "villages" && (
          <SplitLayout className="settings-village-layout">
            <article className="settings-surface settings-village-list-card ui-sticky-surface">
              <h2>{t("registeredVillages")}</h2>
              <p>{t("registeredVillagesHelp")}</p>
              <Field className="village-search">
                <Label>{t("searchVillages")}</Label>
                <Input
                  type="search"
                  value={villageSearch}
                  onChange={(event) => setVillageSearch(event.target.value)}
                  placeholder={t("searchVillages")}
                />
              </Field>
              <div className="settings-village-picker">
                {visibleAccounts.map((item) => (
                  <button
                    key={item.id}
                    className={editing?.id === item.id ? "selected" : ""}
                    onClick={() => chooseAccount(item)}
                  >
                    <i style={{ background: item.color }} />
                    <span>
                      <b>{item.label}</b>
                      <small>
                        {item.playerTag}
                        {item.tags?.length ? ` · ${item.tags.map((tag) => `#${tag}`).join(" ")}` : ""}
                      </small>
                    </span>
                  </button>
                ))}
                {!visibleAccounts.length && <p>{accounts.length ? t("noVillageMatches") : t("noVillages")}</p>}
              </div>
            </article>
            {editing && (
              <button
                type="button"
                className="settings-sheet-backdrop"
                aria-label={t("chooseVillage")}
                onClick={() => setEditing(null)}
              />
            )}
            <article
              className={`settings-surface settings-village-editor-card ${editing ? "is-open" : ""}`}
              id="village-settings-card"
            >
              {editing ? (
                <>
                  <div className="village-editor-heading">
                    <div>
                      <h2>{t("villageSettings")}</h2>
                      <p>{editing.playerTag}</p>
                    </div>
                    <Button
                      className="settings-sheet-close"
                      type="button"
                      size="small"
                      tone="secondary"
                      onClick={() => setEditing(null)}
                    >
                      {t("chooseVillage")}
                    </Button>
                  </div>
                  <div className="village-editor-scroll">
                    <form
                      id="village-settings-form"
                      className="settings-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void run(
                          () =>
                            request(`/api/admin/accounts/${editing.id}`, {
                              method: "PATCH",
                              body: JSON.stringify({
                                ...accountForm,
                                resourcePreparationMinutes: accountForm.resourcePreparationEnabled
                                  ? accountForm.resourcePreparationMinutes
                                  : null,
                              }),
                            }),
                          t("settingsSaved"),
                        );
                      }}
                    >
                      <Field>
                        <Label>{t("displayName")}</Label>
                        <Input
                          required
                          value={accountForm.label}
                          onChange={(e) => setAccountForm({ ...accountForm, label: e.target.value })}
                        />
                      </Field>
                      <Field>
                        <Label>{t("color")}</Label>
                        <Input
                          type="color"
                          value={accountForm.color}
                          onChange={(e) => setAccountForm({ ...accountForm, color: e.target.value })}
                        />
                      </Field>
                      <Field className="wide">
                        <Label>{t("accountTags")}</Label>
                        <Input
                          value={accountForm.tags}
                          onChange={(e) => setAccountForm({ ...accountForm, tags: e.target.value })}
                          placeholder={t("accountTagsPlaceholder")}
                        />
                        <Description>{t("accountTagsHelp")}</Description>
                      </Field>
                      <Field className="wide">
                        <Label>{t("resourceStatus")}</Label>
                        <Select
                          value={accountForm.resourceStatus}
                          onChange={(e) =>
                            setAccountForm({ ...accountForm, resourceStatus: e.target.value as ResourceStatus })
                          }
                        >
                          <option value="abundant">{t("resourceAbundant")}</option>
                          <option value="sufficient">{t("resourceSufficient")}</option>
                          <option value="insufficient">{t("resourceInsufficient")}</option>
                          <option value="unanswered">{t("resourceUnanswered")}</option>
                        </Select>
                        <Description>{t("resourceStatusHelp")}</Description>
                      </Field>
                      <Checkbox
                        className="wide"
                        checked={accountForm.resourcePreparationEnabled}
                        onChange={(e) =>
                          setAccountForm({ ...accountForm, resourcePreparationEnabled: e.target.checked })
                        }
                        label={t("resourcePreparationEnabled")}
                      />
                      {accountForm.resourcePreparationEnabled && (
                        <Field className="wide">
                          <Label>{t("resourcePreparationMinutes")}</Label>
                          <Input
                            type="number"
                            min="1"
                            max="525600"
                            required
                            value={accountForm.resourcePreparationMinutes}
                            onChange={(e) =>
                              setAccountForm({ ...accountForm, resourcePreparationMinutes: Number(e.target.value) })
                            }
                          />
                        </Field>
                      )}
                    </form>
                    <ActionBar className="settings-action-bar" sticky>
                      <Button
                        type="button"
                        tone="danger"
                        disabled={mutationPending}
                        onClick={() => setDeletePromptOpen(true)}
                      >
                        {t("deleteVillage")}
                      </Button>
                      <Button form="village-settings-form" pending={mutationPending}>
                        {mutationPending ? t("saving") : t("saveSettings")}
                      </Button>
                    </ActionBar>
                  </div>
                </>
              ) : (
                <div className="settings-no-selection">{t("chooseVillage")}</div>
              )}
            </article>
          </SplitLayout>
        )}

        {section === "groups" && (
          <article className="settings-surface settings-group-card">
            <h2>{t("groupOrder")}</h2>
            <p>{t("groupOrderHelp")}</p>
            <div className="settings-group-list">
              {availableGroups.map((tag, index) => (
                <div key={tag}>
                  <span>#{tag}</span>
                  <span>
                    <Button
                      type="button"
                      size="small"
                      tone="secondary"
                      disabled={index === 0}
                      onClick={() => moveGroup(index, -1)}
                      aria-label={t("moveGroupUp", { tag })}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      size="small"
                      tone="secondary"
                      disabled={index === availableGroups.length - 1}
                      onClick={() => moveGroup(index, 1)}
                      aria-label={t("moveGroupDown", { tag })}
                    >
                      ↓
                    </Button>
                  </span>
                </div>
              ))}
              {!availableGroups.length && <small>{t("noGroups")}</small>}
            </div>
          </article>
        )}
      </StickyRouteFrame>
      <Dialog
        open={deletePromptOpen}
        onOpenChange={(open) => {
          if (!mutationPending) setDeletePromptOpen(open);
        }}
      >
        <DialogContent
          closeLabel={t("cancel")}
          onEscapeKeyDown={(event) => mutationPending && event.preventDefault()}
          onPointerDownOutside={(event) => mutationPending && event.preventDefault()}
        >
          <DialogTitle>{t("deleteVillage")}</DialogTitle>
          <DialogDescription>{t("deleteConfirm")}</DialogDescription>
          <DialogFooter>
            <Button tone="secondary" disabled={mutationPending} onClick={() => setDeletePromptOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              tone="danger"
              pending={mutationPending}
              onClick={() => {
                if (!editing) return;
                void run(async () => {
                  await request(`/api/admin/accounts/${editing.id}`, { method: "DELETE" });
                  setDeletePromptOpen(false);
                  setEditing(null);
                }, t("deleted"));
              }}
            >
              {t("deleteVillage")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(resourcePrompt)}
        onOpenChange={(open) => {
          if (!open && !resourceResponding) setResourcePrompt(null);
        }}
      >
        <DialogContent
          className="resource-dialog"
          closeLabel={t("resourceAnswerLater")}
          onEscapeKeyDown={(event) => resourceResponding && event.preventDefault()}
          onPointerDownOutside={(event) => resourceResponding && event.preventDefault()}
        >
          <DialogTitle>{t("resourcePromptTitle")}</DialogTitle>
          <DialogDescription>{t("resourcePromptHelp")}</DialogDescription>
          <DialogBody className="resource-dialog-body">
            <div className="resource-dialog-options">
              <Button disabled={resourceResponding} onClick={() => saveResourceResponse("abundant")}>
                {t("resourceAbundant")}
              </Button>
              <Button disabled={resourceResponding} onClick={() => saveResourceResponse("sufficient")}>
                {t("resourceSufficient")}
              </Button>
              <Button disabled={resourceResponding} onClick={() => saveResourceResponse("insufficient")}>
                {t("resourceInsufficient")}
              </Button>
            </div>
            <Button tone="secondary" disabled={resourceResponding} onClick={() => setResourcePrompt(null)}>
              {t("resourceAnswerLater")}
            </Button>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </section>
  );
}

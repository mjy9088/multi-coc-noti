"use client";

import {
  Button,
  Checkbox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  RequestState,
  SelectionList,
  SelectionListContent,
  SelectionListDescription,
  SelectionListItem,
  SelectionListLeading,
  SelectionListTitle,
  StickyStackItem,
  Tab,
  Tabs,
  useToast,
} from "@multi-coc/ui";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  SettingsActions,
  SettingsFields,
  SettingsInputField,
  SettingsIntro,
  SettingsPage,
  SettingsRouteFrame,
  SettingsSelectField,
  SettingsSurface,
  SettingsTextareaField,
  SettingsVillageBackdrop,
  SettingsVillageEditor,
  SettingsVillageEditorScroll,
  SettingsVillageLayout,
  SettingsVillageListPane,
  SettingsVillagePicker,
} from "../components/settings/settings-layout";
import { ErrorState, LoadingState } from "./request-state";
import UpgradeAvailabilityPanel from "./upgrade-availability-panel";
import { useApiRequest } from "./use-api-request";
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
type NotificationChannel = {
  id: string;
  label: string;
  enabled: boolean;
  locale: "ko" | "en";
  baseUrl: string;
  defaultGroup: string | null;
  deviceKeySuffix: string;
};
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
const settingsLoadedAt = Date.now();
type SettingsSection = "import" | "upgrades" | "channels" | "villages" | "groups";
type QuickPasteRequest = { id: number; text: string; clipboardError: boolean } | null;

export default function SettingsPanel({
  apiBase,
  onChanged,
  onSectionChange,
  onVillageChange,
  initialSection = "import",
  initialAccountId = null,
  quickPasteRequest = null,
  onQuickPasteApplied,
  embedded = false,
  onImportComplete,
  onImportPendingChange,
}: {
  apiBase: string;
  onChanged: () => void;
  onSectionChange?: (section: SettingsSection) => void;
  onVillageChange?: (accountId: string) => void;
  initialSection?: SettingsSection;
  initialAccountId?: string | null;
  quickPasteRequest?: QuickPasteRequest;
  onQuickPasteApplied?: (id: number) => void;
  embedded?: boolean;
  onImportComplete?: () => void;
  onImportPendingChange?: (pending: boolean) => void;
}) {
  const t = useTranslations("Settings");
  const { dismiss, toast } = useToast();
  const { formatDateTime, formatDuration } = useDashboardFormat();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [groupOrder, setGroupOrder] = useState<string[]>([]);
  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [notificationChannels, setNotificationChannels] = useState<NotificationChannel[]>([]);
  const [barkChannelForm, setBarkChannelForm] = useState({
    label: "iPhone",
    deviceKey: "",
    locale: "ko" as "ko" | "en",
  });
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
  const [clockNow, setClockNow] = useState(settingsLoadedAt);
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

  useEffect(() => {
    onImportPendingChange?.(importing || resourceResponding);
    return () => onImportPendingChange?.(false);
  }, [importing, onImportPendingChange, resourceResponding]);

  const request = useApiRequest(apiBase);

  const load = useCallback(async () => {
    setInitialLoading(true);
    try {
      if (section === "channels") {
        const channelResult = await request("/api/notification-channels");
        setNotificationChannels(channelResult.channels || []);
      } else {
        const [accountResult, sectionResult] = await Promise.all([
          request("/api/villages"),
          section === "upgrades"
            ? request("/api/settings/upgrades")
            : section === "groups"
              ? request("/api/settings/dashboard")
              : Promise.resolve(null),
        ]);
        setAccounts(accountResult.accounts);
        setEditing((current) =>
          current ? accountResult.accounts.find((item: Account) => item.id === current.id) || null : null,
        );
        if (section === "upgrades" && sectionResult) {
          setUpgrades(sectionResult.upgrades);
          setUpgradeAlertDrafts(
            Object.fromEntries(
              sectionResult.upgrades.map((upgrade: Upgrade) => [
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
        }
        if (section === "groups" && sectionResult) setGroupOrder(sectionResult.groupOrder || []);
      }
      setError("");
      setInitialLoadFailed(false);
    } catch (reason) {
      setError((reason as Error).message);
      setInitialLoadFailed(true);
    } finally {
      setInitialLoading(false);
    }
  }, [request, section]);
  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
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
    if (initialLoadFailed) {
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
  }, [dismiss, error, initialLoadFailed, message, toast]);

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
        const result = await request("/api/village-exports/preview", {
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
    if (!quickPasteRequest || appliedQuickPaste.current === quickPasteRequest.id) return;
    const timer = window.setTimeout(() => {
      appliedQuickPaste.current = quickPasteRequest.id;
      onQuickPasteApplied?.(quickPasteRequest.id);
      onSectionChange?.("import");
      if (quickPasteRequest.text) replaceExportText(quickPasteRequest.text);
      else if (quickPasteRequest.clipboardError) setError(t("clipboardUnavailable"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [onQuickPasteApplied, onSectionChange, quickPasteRequest, replaceExportText, t]);

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
      () => request("/api/settings/dashboard", { method: "PATCH", body: JSON.stringify({ groupOrder: next }) }),
      t("groupOrderSaved"),
    );
  };

  const submitImport = async () => {
    if (!preview || importing) return;
    const askForResources = preview.upgrades.length > 0;
    setImporting(true);
    const result = await run(
      () => request("/api/village-exports", { method: "POST", body: JSON.stringify({ exportText, label: newLabel }) }),
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
      else onImportComplete?.();
    }
  };

  const saveResourceResponse = async (resourceStatus: Exclude<ResourceStatus, "unanswered">) => {
    if (!resourcePrompt || resourceResponding) return;
    setResourceResponding(true);
    const result = await run(
      () =>
        request(`/api/villages/${resourcePrompt.accountId}/resource-status`, {
          method: "PATCH",
          body: JSON.stringify({ resourceStatus }),
        }),
      t("resourceStatusSaved"),
    );
    setResourceResponding(false);
    if (result) {
      setResourcePrompt(null);
      onImportComplete?.();
    }
  };

  const saveUpgradeAlert = async (upgrade: Upgrade) => {
    const draft = upgradeAlertDrafts[upgrade.id] || { mode: "inherit", minutes: 60 };
    const override = draft.mode === "inherit" ? null : draft.mode === "disabled" ? 0 : draft.minutes;
    setSavingUpgradeId(upgrade.id);
    await run(
      () =>
        request(`/api/settings/upgrades/${upgrade.id}/alerts`, {
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

  const addBarkChannel = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await run(async () => {
      await request("/api/notification-channels", {
        method: "POST",
        body: JSON.stringify({
          ...barkChannelForm,
          enabled: true,
          baseUrl: "https://api.day.app",
          defaultGroup: "Multi CoC Noti",
        }),
      });
      setBarkChannelForm((current) => ({ ...current, deviceKey: "" }));
    }, t("notificationChannelSaved"));
  };

  if (initialLoading && !accounts.length)
    return (
      <SettingsPage>
        <LoadingState compact />
      </SettingsPage>
    );
  if (initialLoadFailed && !accounts.length)
    return (
      <SettingsPage>
        <ErrorState compact message={error} retry={() => void load()} />
      </SettingsPage>
    );

  return (
    <SettingsPage embedded={embedded}>
      {!embedded && <SettingsIntro eyebrow="VILLAGE DATA" title={t("title")} />}
      {!embedded && (
        <StickyStackItem order={10} className="settings-tabs-sticky ui-sticky-surface">
          <Tabs
            className="settings-tabs"
            label={t("settingsSections")}
            value={section}
            onValueChange={(value) => {
              const next = value as SettingsSection;
              onSectionChange?.(next);
            }}
          >
            <Tab value="import">{t("updateData")}</Tab>
            <Tab value="upgrades">{t("upgradeAlerts")}</Tab>
            <Tab value="channels">{t("notificationChannels")}</Tab>
            <Tab value="villages">{t("manageVillages")}</Tab>
            <Tab value="groups">{t("manageGroups")}</Tab>
          </Tabs>
        </StickyStackItem>
      )}
      <SettingsRouteFrame contained={embedded} scrollKey={section}>
        {section === "import" && (
          <div className="settings-import-flow">
            {error && !initialLoadFailed && (
              <RequestState className="settings-import-error" tone="error" title={error} />
            )}
            {(!embedded || !resourcePrompt) && (
              <SettingsSurface
                kind="import"
                step={preview ? "complete" : "current"}
                aria-current={!preview ? "step" : undefined}
              >
                <p className="settings-step-label" data-step-state={preview ? t("stepDone") : t("stepNow")}>
                  01 · PASTE
                </p>
                <h2>{t("pasteJson")}</h2>
                <p>{t("pasteJsonHelp")}</p>
                <SettingsTextareaField
                  label={t("pasteJson")}
                  labelVisibility="hidden"
                  value={exportText}
                  onChange={(event) => replaceExportText(event.target.value)}
                  placeholder='{"tag":"#...","timestamp":...}'
                  autoFocus
                  spellCheck={false}
                  autoCapitalize="off"
                  aria-busy={previewLoading}
                />
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
              </SettingsSurface>
            )}

            {preview && (!embedded || !resourcePrompt) && (
              <SettingsSurface kind="preview" step="current" aria-current="step">
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
                  <SettingsInputField
                    placement="new-village"
                    label={t("displayName")}
                    description={t("newVillageHelp")}
                    required
                    autoFocus
                    value={newLabel}
                    onChange={(event) => setNewLabel(event.target.value)}
                    placeholder={t("displayNamePlaceholder")}
                  />
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
              </SettingsSurface>
            )}
            {embedded && resourcePrompt && (
              <SettingsSurface kind="resource-prompt" aria-live="polite">
                <h2>{t("resourcePromptTitle")}</h2>
                <p>{t("resourcePromptHelp")}</p>
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
                <Button
                  tone="secondary"
                  disabled={resourceResponding}
                  onClick={() => {
                    setResourcePrompt(null);
                    onImportComplete?.();
                  }}
                >
                  {t("resourceAnswerLater")}
                </Button>
              </SettingsSurface>
            )}
          </div>
        )}

        {section === "channels" && (
          <SettingsSurface kind="channels">
            <h2>{t("barkChannels")}</h2>
            <p>{t("barkChannelsHelp")}</p>
            <div className="settings-upgrade-list">
              {notificationChannels.map((channel) => (
                <div className="settings-upgrade-row" key={channel.id}>
                  <div className="settings-upgrade-heading">
                    <span>
                      <b>{channel.label}</b>
                      <small>{`${channel.baseUrl} · ••••${channel.deviceKeySuffix} · ${channel.locale.toUpperCase()}`}</small>
                    </span>
                    <Button
                      type="button"
                      tone="danger"
                      onClick={() =>
                        void run(
                          () => request(`/api/notification-channels/${channel.id}`, { method: "DELETE" }),
                          t("notificationChannelDeleted"),
                        )
                      }
                    >
                      {t("delete")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <SettingsFields as="form" layout="controls" onSubmit={addBarkChannel}>
              <SettingsInputField
                label={t("channelName")}
                required
                value={barkChannelForm.label}
                onChange={(event) => setBarkChannelForm({ ...barkChannelForm, label: event.target.value })}
              />
              <SettingsInputField
                label={t("barkDeviceKey")}
                required
                type="password"
                autoComplete="off"
                value={barkChannelForm.deviceKey}
                onChange={(event) => setBarkChannelForm({ ...barkChannelForm, deviceKey: event.target.value })}
              />
              <SettingsSelectField
                label={t("notificationLanguage")}
                value={barkChannelForm.locale}
                onChange={(event) =>
                  setBarkChannelForm({ ...barkChannelForm, locale: event.target.value === "en" ? "en" : "ko" })
                }
              >
                <option value="ko">한국어</option>
                <option value="en">English</option>
              </SettingsSelectField>
              <Button type="submit">{t("addNotificationChannel")}</Button>
            </SettingsFields>
          </SettingsSurface>
        )}

        {section === "upgrades" && (
          <SettingsSurface kind="upgrades">
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
                        <SettingsFields layout="controls">
                          <SettingsSelectField
                            label={t("preparationAlertSetting")}
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
                          </SettingsSelectField>
                          {draft.mode === "custom" && (
                            <SettingsInputField
                              label={t("resourcePreparationMinutes")}
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
                        </SettingsFields>
                      </div>
                    );
                  })
              ) : (
                <p>{t("noTrackedUpgrades")}</p>
              )}
            </div>
          </SettingsSurface>
        )}

        {section === "villages" && (
          <SettingsVillageLayout>
            <SettingsVillageListPane>
              <h2>{t("registeredVillages")}</h2>
              <p>{t("registeredVillagesHelp")}</p>
              <SettingsInputField
                placement="search"
                label={t("searchVillages")}
                type="search"
                value={villageSearch}
                onChange={(event) => setVillageSearch(event.target.value)}
                placeholder={t("searchVillages")}
              />
              <SettingsVillagePicker>
                <SelectionList>
                  {visibleAccounts.map((item) => (
                    <SelectionListItem
                      key={item.id}
                      selected={editing?.id === item.id}
                      onClick={() => chooseAccount(item)}
                    >
                      <SelectionListLeading>
                        <i style={{ background: item.color }} />
                      </SelectionListLeading>
                      <SelectionListContent>
                        <SelectionListTitle>{item.label}</SelectionListTitle>
                        <SelectionListDescription>
                          {item.playerTag}
                          {item.tags?.length ? ` · ${item.tags.map((tag) => `#${tag}`).join(" ")}` : ""}
                        </SelectionListDescription>
                      </SelectionListContent>
                    </SelectionListItem>
                  ))}
                  {!visibleAccounts.length && <p>{accounts.length ? t("noVillageMatches") : t("noVillages")}</p>}
                </SelectionList>
              </SettingsVillagePicker>
            </SettingsVillageListPane>
            <SettingsVillageBackdrop
              open={Boolean(editing)}
              label={t("chooseVillage")}
              onClick={() => setEditing(null)}
            />
            <SettingsVillageEditor open={Boolean(editing)} id="village-settings-card">
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
                  <SettingsVillageEditorScroll>
                    <SettingsFields
                      as="form"
                      layout="form"
                      id="village-settings-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void run(
                          () =>
                            request(`/api/villages/${editing.id}`, {
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
                      <SettingsInputField
                        label={t("displayName")}
                        required
                        value={accountForm.label}
                        onChange={(e) => setAccountForm({ ...accountForm, label: e.target.value })}
                      />
                      <SettingsInputField
                        label={t("color")}
                        type="color"
                        value={accountForm.color}
                        onChange={(e) => setAccountForm({ ...accountForm, color: e.target.value })}
                      />
                      <SettingsInputField
                        placement="wide"
                        label={t("accountTags")}
                        description={t("accountTagsHelp")}
                        value={accountForm.tags}
                        onChange={(e) => setAccountForm({ ...accountForm, tags: e.target.value })}
                        placeholder={t("accountTagsPlaceholder")}
                      />
                      <SettingsSelectField
                        placement="wide"
                        label={t("resourceStatus")}
                        description={t("resourceStatusHelp")}
                        value={accountForm.resourceStatus}
                        onChange={(e) =>
                          setAccountForm({ ...accountForm, resourceStatus: e.target.value as ResourceStatus })
                        }
                      >
                        <option value="abundant">{t("resourceAbundant")}</option>
                        <option value="sufficient">{t("resourceSufficient")}</option>
                        <option value="insufficient">{t("resourceInsufficient")}</option>
                        <option value="unanswered">{t("resourceUnanswered")}</option>
                      </SettingsSelectField>
                      <Checkbox
                        className="wide"
                        checked={accountForm.resourcePreparationEnabled}
                        onChange={(e) =>
                          setAccountForm({ ...accountForm, resourcePreparationEnabled: e.target.checked })
                        }
                        label={t("resourcePreparationEnabled")}
                      />
                      {accountForm.resourcePreparationEnabled && (
                        <SettingsInputField
                          placement="wide"
                          label={t("resourcePreparationMinutes")}
                          type="number"
                          min="1"
                          max="525600"
                          required
                          value={accountForm.resourcePreparationMinutes}
                          onChange={(e) =>
                            setAccountForm({ ...accountForm, resourcePreparationMinutes: Number(e.target.value) })
                          }
                        />
                      )}
                    </SettingsFields>
                    <SettingsActions>
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
                    </SettingsActions>
                  </SettingsVillageEditorScroll>
                </>
              ) : (
                <div className="settings-no-selection">{t("chooseVillage")}</div>
              )}
            </SettingsVillageEditor>
          </SettingsVillageLayout>
        )}

        {section === "groups" && (
          <SettingsSurface kind="groups">
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
          </SettingsSurface>
        )}
      </SettingsRouteFrame>
      {!embedded && (
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
                    await request(`/api/villages/${editing.id}`, { method: "DELETE" });
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
      )}
      {!embedded && (
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
      )}
    </SettingsPage>
  );
}

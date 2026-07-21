"use client";

import "./settings.css";

import { Button, PageIntro, RequestState, StickyRouteFrame, StickyStackItem, Tab, Tabs, useToast } from "@multi-coc/ui";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorState, LoadingState } from "../../app/request-state";
import UpgradeAvailabilityPanel from "../../app/upgrade-availability-panel";
import { useApiRequest } from "../../app/use-api-request";
import { useDashboardFormat } from "../../app/use-dashboard-format";
import { useMutationFeedback } from "../../app/use-mutation-feedback";
import { DeleteVillageDialog, ResourceStatusDialog } from "./settings-dialogs";
import { SettingsInputField, SettingsPage, SettingsSurface, SettingsTextareaField } from "./settings-layout";
import type {
  Account,
  ExportPreview,
  NotificationChannel,
  QuickPasteRequest,
  ResourceStatus,
  SettingsSection,
  Upgrade,
  UpgradeAlertDraft,
} from "./settings-model";
import { GroupOrderSettings, NotificationChannelsSettings, UpgradeAlertSettings } from "./settings-sections";
import { VillageSettings } from "./village-settings";

const settingsLoadedAt = Date.now();

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
      {!embedded && (
        <PageIntro className="settings-page-header" spacing="none" eyebrow="VILLAGE DATA" title={t("title")} />
      )}
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
      <StickyRouteFrame className="settings-route-frame" contained={embedded} scrollKey={section}>
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
          <NotificationChannelsSettings
            channels={notificationChannels}
            form={barkChannelForm}
            setForm={setBarkChannelForm}
            onSubmit={addBarkChannel}
            onDelete={(channel) =>
              void run(
                () => request(`/api/notification-channels/${channel.id}`, { method: "DELETE" }),
                t("notificationChannelDeleted"),
              )
            }
          />
        )}

        {section === "upgrades" && (
          <UpgradeAlertSettings
            accounts={accounts}
            upgrades={upgrades}
            drafts={upgradeAlertDrafts}
            setDrafts={setUpgradeAlertDrafts}
            savingUpgradeId={savingUpgradeId}
            clockNow={clockNow}
            onOpenVillage={openVillageSettings}
            onSave={(upgrade) => void saveUpgradeAlert(upgrade)}
          />
        )}

        {section === "villages" && (
          <VillageSettings
            accounts={accounts}
            visibleAccounts={visibleAccounts}
            editing={editing}
            form={accountForm}
            setForm={setAccountForm}
            search={villageSearch}
            setSearch={setVillageSearch}
            mutationPending={mutationPending}
            onChoose={chooseAccount}
            onClose={() => setEditing(null)}
            onDeleteRequest={() => setDeletePromptOpen(true)}
            onSubmit={(event) => {
              event.preventDefault();
              if (!editing) return;
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
          />
        )}

        {section === "groups" && <GroupOrderSettings groups={availableGroups} onMove={moveGroup} />}
      </StickyRouteFrame>
      {!embedded && (
        <DeleteVillageDialog
          open={deletePromptOpen}
          pending={mutationPending}
          onOpenChange={setDeletePromptOpen}
          onConfirm={() => {
            if (!editing) return;
            void run(async () => {
              await request(`/api/villages/${editing.id}`, { method: "DELETE" });
              setDeletePromptOpen(false);
              setEditing(null);
            }, t("deleted"));
          }}
        />
      )}
      {!embedded && (
        <ResourceStatusDialog
          open={Boolean(resourcePrompt)}
          pending={resourceResponding}
          onOpenChange={(open) => !open && setResourcePrompt(null)}
          onRespond={(status) => void saveResourceResponse(status)}
        />
      )}
    </SettingsPage>
  );
}

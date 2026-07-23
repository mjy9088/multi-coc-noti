"use client";

import "./settings.css";

import {
  type OperationState,
  operationFailed,
  operationPending,
  operationSucceeded,
  PageIntro,
  StickyRouteFrame,
  StickyStackItem,
  Tab,
  Tabs,
  useToast,
} from "@multi-coc/ui";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorState, LoadingState } from "../request-state";
import { useDashboardFormat } from "../use-dashboard-format";
import { GroupOrderTab } from "./group-order-tab";
import { ImportDataTab } from "./import-data/import-data-tab";
import { NotificationChannelsTab } from "./notification-channels/notification-channels-tab";
import { DeleteVillageDialog, ResourceStatusDialog } from "./settings-dialogs";
import { SettingsPage } from "./settings-layout";
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
import { UpgradeAlertsTab } from "./upgrade-alerts/upgrade-alerts-tab";
import { useApiRequest } from "./use-api-request";
import { useMutationFeedback } from "./use-mutation-feedback";
import { VillageSettingsTab } from "./village-settings/village-settings-tab";

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
  const [loadState, setLoadState] = useState<OperationState<null, string>>({ status: "idle" });
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
    setLoadState(operationPending());
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
      setLoadState(operationSucceeded(null));
    } catch (reason) {
      setLoadState(operationFailed((reason as Error).message));
    }
  }, [request, section]);
  const { feedback, mutationPending, run, clearFeedback, showError } = useMutationFeedback({
    refresh: load,
    onChanged,
  });
  const initialLoading = loadState.status === "pending";
  const initialLoadFailed = loadState.status === "error";
  const loadError = loadState.status === "error" ? loadState.error : undefined;
  const feedbackError = feedback.status === "error" ? feedback.error : null;
  useEffect(() => {
    const timer = window.setTimeout(load, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
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
    if (feedback.status === "error") {
      toast({ id, intent: "error", title: feedback.error, duration: null });
      return;
    }
    if (feedback.status === "success") {
      toast({ id, intent: "success", title: feedback.value });
      return;
    }
    dismiss(id);
  }, [dismiss, feedback, initialLoadFailed, toast]);

  const reviewExport = useCallback(
    async (text: string) => {
      const candidate = text.trim();
      if (!candidate || reviewingText.current === candidate || lastReviewedText.current === candidate) return;
      const sequence = ++reviewSequence.current;
      reviewingText.current = candidate;
      setPreviewLoading(true);
      clearFeedback();
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
          showError((reason as Error).message);
        }
      } finally {
        if (sequence === reviewSequence.current) setPreviewLoading(false);
        if (reviewingText.current === candidate) reviewingText.current = "";
      }
    },
    [clearFeedback, request, showError],
  );

  const replaceExportText = useCallback(
    (text: string) => {
      reviewSequence.current += 1;
      reviewingText.current = "";
      lastReviewedText.current = "";
      setPreviewLoading(false);
      setExportText(text);
      setPreview(null);
      setNewLabel("");
      clearFeedback();
    },
    [clearFeedback],
  );

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
      else if (quickPasteRequest.clipboardError) showError(t("clipboardUnavailable"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [onQuickPasteApplied, onSectionChange, quickPasteRequest, replaceExportText, showError, t]);

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
      showError(t("clipboardUnavailable"));
    }
  };

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
        <ErrorState compact message={loadError} retry={() => void load()} />
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
          <ImportDataTab
            error={feedbackError}
            initialLoadFailed={initialLoadFailed}
            embedded={embedded}
            resourcePromptOpen={Boolean(resourcePrompt)}
            preview={preview}
            exportText={exportText}
            previewLoading={previewLoading}
            newLabel={newLabel}
            importing={importing}
            resourceResponding={resourceResponding}
            clockNow={clockNow}
            confirmImportButton={confirmImportButton}
            formatDateTime={formatDateTime}
            formatDuration={formatDuration}
            onExportTextChange={replaceExportText}
            onPasteClipboard={pasteFromClipboard}
            onReview={() => reviewExport(exportText)}
            onNewLabelChange={setNewLabel}
            onClearPreview={() => setPreview(null)}
            onSubmitImport={submitImport}
            onResourceResponse={(status) => void saveResourceResponse(status)}
            onResourceAnswerLater={() => {
              setResourcePrompt(null);
              onImportComplete?.();
            }}
          />
        )}
        {section === "channels" && (
          <NotificationChannelsTab
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
          <UpgradeAlertsTab
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
          <VillageSettingsTab
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

        {section === "groups" && <GroupOrderTab groups={availableGroups} onMove={moveGroup} />}
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

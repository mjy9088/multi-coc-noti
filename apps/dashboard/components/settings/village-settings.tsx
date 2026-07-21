"use client";

import {
  ActionBar,
  Button,
  Checkbox,
  DetailPane,
  DetailPaneBackdrop,
  MasterDetailLayout,
  MasterPane,
  ScrollablePane,
  SelectionList,
  SelectionListContent,
  SelectionListDescription,
  SelectionListItem,
  SelectionListLeading,
  SelectionListTitle,
} from "@multi-coc/ui";
import { useTranslations } from "next-intl";
import type { Dispatch, FormEventHandler, SetStateAction } from "react";
import { SettingsFields, SettingsInputField, SettingsSelectField } from "./settings-layout";
import type { Account, ResourceStatus, VillageAccountForm } from "./settings-model";

export function VillageSettings({
  accounts,
  visibleAccounts,
  editing,
  form,
  setForm,
  search,
  setSearch,
  mutationPending,
  onChoose,
  onClose,
  onSubmit,
  onDeleteRequest,
}: {
  accounts: Account[];
  visibleAccounts: Account[];
  editing: Account | null;
  form: VillageAccountForm;
  setForm: Dispatch<SetStateAction<VillageAccountForm>>;
  search: string;
  setSearch: (value: string) => void;
  mutationPending: boolean;
  onChoose: (account: Account) => void;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onDeleteRequest: () => void;
}) {
  const t = useTranslations("Settings");
  return (
    <MasterDetailLayout className="settings-village-layout">
      <MasterPane className="settings-surface settings-village-list-card ui-sticky-surface">
        <h2>{t("registeredVillages")}</h2>
        <p>{t("registeredVillagesHelp")}</p>
        <SettingsInputField
          placement="search"
          label={t("searchVillages")}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("searchVillages")}
        />
        <ScrollablePane className="settings-village-picker" boundary="contain" activation="sticky-frame">
          <SelectionList>
            {visibleAccounts.map((item) => (
              <SelectionListItem key={item.id} selected={editing?.id === item.id} onClick={() => onChoose(item)}>
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
        </ScrollablePane>
      </MasterPane>
      <DetailPaneBackdrop
        className="settings-sheet-backdrop"
        open={Boolean(editing)}
        label={t("chooseVillage")}
        onClick={onClose}
      />
      <DetailPane
        className="settings-surface settings-village-editor-card"
        open={Boolean(editing)}
        id="village-settings-card"
      >
        {editing ? (
          <>
            <div className="village-editor-heading">
              <div>
                <h2>{t("villageSettings")}</h2>
                <p>{editing.playerTag}</p>
              </div>
              <Button className="settings-sheet-close" type="button" size="small" tone="secondary" onClick={onClose}>
                {t("chooseVillage")}
              </Button>
            </div>
            <ScrollablePane className="village-editor-scroll" boundary="contain" activation="sticky-frame-or-compact">
              <SettingsFields as="form" layout="form" id="village-settings-form" onSubmit={onSubmit}>
                <SettingsInputField
                  label={t("displayName")}
                  required
                  value={form.label}
                  onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
                />
                <SettingsInputField
                  label={t("color")}
                  type="color"
                  value={form.color}
                  onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
                />
                <SettingsInputField
                  placement="wide"
                  label={t("accountTags")}
                  description={t("accountTagsHelp")}
                  value={form.tags}
                  onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
                  placeholder={t("accountTagsPlaceholder")}
                />
                <SettingsSelectField
                  placement="wide"
                  label={t("resourceStatus")}
                  description={t("resourceStatusHelp")}
                  value={form.resourceStatus}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, resourceStatus: event.target.value as ResourceStatus }))
                  }
                >
                  <option value="abundant">{t("resourceAbundant")}</option>
                  <option value="sufficient">{t("resourceSufficient")}</option>
                  <option value="insufficient">{t("resourceInsufficient")}</option>
                  <option value="unanswered">{t("resourceUnanswered")}</option>
                </SettingsSelectField>
                <Checkbox
                  className="wide"
                  checked={form.resourcePreparationEnabled}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, resourcePreparationEnabled: event.target.checked }))
                  }
                  label={t("resourcePreparationEnabled")}
                />
                {form.resourcePreparationEnabled && (
                  <SettingsInputField
                    placement="wide"
                    label={t("resourcePreparationMinutes")}
                    type="number"
                    min="1"
                    max="525600"
                    required
                    value={form.resourcePreparationMinutes}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, resourcePreparationMinutes: Number(event.target.value) }))
                    }
                  />
                )}
              </SettingsFields>
              <ActionBar className="settings-action-bar" sticky>
                <Button type="button" tone="danger" disabled={mutationPending} onClick={onDeleteRequest}>
                  {t("deleteVillage")}
                </Button>
                <Button form="village-settings-form" pending={mutationPending}>
                  {mutationPending ? t("saving") : t("saveSettings")}
                </Button>
              </ActionBar>
            </ScrollablePane>
          </>
        ) : (
          <div className="settings-no-selection">{t("chooseVillage")}</div>
        )}
      </DetailPane>
    </MasterDetailLayout>
  );
}

"use client";

import { ActionBar, Button, Checkbox, DetailPane, ScrollablePane } from "@multi-coc/ui";
import { useTranslations } from "next-intl";
import type { Dispatch, FormEventHandler, SetStateAction } from "react";
import { SettingsFields, SettingsInputField, SettingsSelectField } from "../settings-layout";
import type { Account, ResourceStatus, VillageAccountForm } from "../settings-model";

export function VillageEditorPane({
  editing,
  form,
  setForm,
  mutationPending,
  onClose,
  onSubmit,
  onDeleteRequest,
}: {
  editing: Account | null;
  form: VillageAccountForm;
  setForm: Dispatch<SetStateAction<VillageAccountForm>>;
  mutationPending: boolean;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onDeleteRequest: () => void;
}) {
  const t = useTranslations("Settings");
  return (
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
  );
}

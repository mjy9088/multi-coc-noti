"use client";

import { DetailPaneBackdrop, MasterDetailLayout } from "@multi-coc/ui";
import { useTranslations } from "next-intl";
import type { Dispatch, FormEventHandler, SetStateAction } from "react";
import type { Account, VillageAccountForm } from "../settings-model";
import { VillageEditorPane } from "./village-editor-pane";
import { VillageListPane } from "./village-list-pane";

export function VillageSettingsTab({
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
      <VillageListPane
        accounts={accounts}
        visibleAccounts={visibleAccounts}
        selectedId={editing?.id}
        search={search}
        onSearchChange={setSearch}
        onChoose={onChoose}
      />
      <DetailPaneBackdrop
        className="settings-sheet-backdrop"
        open={Boolean(editing)}
        label={t("chooseVillage")}
        onClick={onClose}
      />
      <VillageEditorPane
        editing={editing}
        form={form}
        setForm={setForm}
        mutationPending={mutationPending}
        onClose={onClose}
        onSubmit={onSubmit}
        onDeleteRequest={onDeleteRequest}
      />
    </MasterDetailLayout>
  );
}

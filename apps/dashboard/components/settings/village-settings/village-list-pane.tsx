"use client";

import {
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
import { SettingsInputField } from "../settings-layout";
import type { Account } from "../settings-model";

export function VillageListPane({
  accounts,
  visibleAccounts,
  selectedId,
  search,
  onSearchChange,
  onChoose,
}: {
  accounts: Account[];
  visibleAccounts: Account[];
  selectedId: string | undefined;
  search: string;
  onSearchChange: (value: string) => void;
  onChoose: (account: Account) => void;
}) {
  const t = useTranslations("Settings");
  return (
    <MasterPane className="settings-surface settings-village-list-card ui-sticky-surface">
      <h2>{t("registeredVillages")}</h2>
      <p>{t("registeredVillagesHelp")}</p>
      <SettingsInputField
        placement="search"
        label={t("searchVillages")}
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={t("searchVillages")}
      />
      <ScrollablePane className="settings-village-picker" boundary="contain" activation="sticky-frame">
        <SelectionList>
          {visibleAccounts.map((account) => (
            <SelectionListItem key={account.id} selected={selectedId === account.id} onClick={() => onChoose(account)}>
              <SelectionListLeading>
                <i style={{ background: account.color }} />
              </SelectionListLeading>
              <SelectionListContent>
                <SelectionListTitle>{account.label}</SelectionListTitle>
                <SelectionListDescription>
                  {account.playerTag}
                  {account.tags?.length ? ` · ${account.tags.map((tag) => `#${tag}`).join(" ")}` : ""}
                </SelectionListDescription>
              </SelectionListContent>
            </SelectionListItem>
          ))}
          {!visibleAccounts.length && <p>{accounts.length ? t("noVillageMatches") : t("noVillages")}</p>}
        </SelectionList>
      </ScrollablePane>
    </MasterPane>
  );
}

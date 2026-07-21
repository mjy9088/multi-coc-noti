"use client";

import { Button, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@multi-coc/ui";
import { useTranslations } from "next-intl";
import type { ResourceStatus } from "./settings-model";

export function DeleteVillageDialog({
  open,
  pending,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("Settings");
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent
        closeLabel={t("cancel")}
        onEscapeKeyDown={(event) => pending && event.preventDefault()}
        onPointerDownOutside={(event) => pending && event.preventDefault()}
      >
        <DialogTitle>{t("deleteVillage")}</DialogTitle>
        <DialogDescription>{t("deleteConfirm")}</DialogDescription>
        <DialogFooter>
          <Button tone="secondary" disabled={pending} onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button tone="danger" pending={pending} onClick={onConfirm}>
            {t("deleteVillage")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ResourceStatusDialog({
  open,
  pending,
  onOpenChange,
  onRespond,
}: {
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onRespond: (status: Exclude<ResourceStatus, "unanswered">) => void;
}) {
  const t = useTranslations("Settings");
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !pending && onOpenChange(false)}>
      <DialogContent
        className="resource-dialog"
        closeLabel={t("resourceAnswerLater")}
        onEscapeKeyDown={(event) => pending && event.preventDefault()}
        onPointerDownOutside={(event) => pending && event.preventDefault()}
      >
        <DialogTitle>{t("resourcePromptTitle")}</DialogTitle>
        <DialogDescription>{t("resourcePromptHelp")}</DialogDescription>
        <DialogBody className="resource-dialog-body">
          <div className="resource-dialog-options">
            <Button disabled={pending} onClick={() => onRespond("abundant")}>
              {t("resourceAbundant")}
            </Button>
            <Button disabled={pending} onClick={() => onRespond("sufficient")}>
              {t("resourceSufficient")}
            </Button>
            <Button disabled={pending} onClick={() => onRespond("insufficient")}>
              {t("resourceInsufficient")}
            </Button>
          </div>
          <Button tone="secondary" disabled={pending} onClick={() => onOpenChange(false)}>
            {t("resourceAnswerLater")}
          </Button>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

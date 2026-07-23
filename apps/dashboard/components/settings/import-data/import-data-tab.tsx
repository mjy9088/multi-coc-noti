"use client";

import { RequestState } from "@multi-coc/ui";
import type { RefObject } from "react";
import type { ExportPreview, ResourceStatus } from "../settings-model";
import { ImportPasteStep } from "./import-paste-step";
import { ImportReviewStep } from "./import-review-step";
import { ResourceStatusPrompt } from "./resource-status-prompt";

export function ImportDataTab({
  error,
  initialLoadFailed,
  embedded,
  resourcePromptOpen,
  preview,
  exportText,
  previewLoading,
  newLabel,
  importing,
  resourceResponding,
  clockNow,
  confirmImportButton,
  formatDateTime,
  formatDuration,
  onExportTextChange,
  onPasteClipboard,
  onReview,
  onNewLabelChange,
  onClearPreview,
  onSubmitImport,
  onResourceResponse,
  onResourceAnswerLater,
}: {
  error: string | null;
  initialLoadFailed: boolean;
  embedded: boolean;
  resourcePromptOpen: boolean;
  preview: ExportPreview | null;
  exportText: string;
  previewLoading: boolean;
  newLabel: string;
  importing: boolean;
  resourceResponding: boolean;
  clockNow: number;
  confirmImportButton: RefObject<HTMLButtonElement | null>;
  formatDateTime: (input: Date | string) => string;
  formatDuration: (input: Date | string, reference: number) => string;
  onExportTextChange: (value: string) => void;
  onPasteClipboard: () => void;
  onReview: () => void;
  onNewLabelChange: (value: string) => void;
  onClearPreview: () => void;
  onSubmitImport: () => void;
  onResourceResponse: (status: Exclude<ResourceStatus, "unanswered">) => void;
  onResourceAnswerLater: () => void;
}) {
  const showMainFlow = !embedded || !resourcePromptOpen;
  return (
    <div className="settings-import-flow">
      {error && !initialLoadFailed && <RequestState className="settings-import-error" tone="error" title={error} />}
      {showMainFlow && (
        <ImportPasteStep
          complete={Boolean(preview)}
          exportText={exportText}
          previewLoading={previewLoading}
          onExportTextChange={onExportTextChange}
          onPasteClipboard={onPasteClipboard}
          onReview={onReview}
        />
      )}
      {preview && showMainFlow && (
        <ImportReviewStep
          preview={preview}
          newLabel={newLabel}
          importing={importing}
          clockNow={clockNow}
          confirmImportButton={confirmImportButton}
          formatDateTime={formatDateTime}
          formatDuration={formatDuration}
          onNewLabelChange={onNewLabelChange}
          onClearPreview={onClearPreview}
          onSubmitImport={onSubmitImport}
        />
      )}
      {embedded && resourcePromptOpen && (
        <ResourceStatusPrompt
          pending={resourceResponding}
          onResponse={onResourceResponse}
          onAnswerLater={onResourceAnswerLater}
        />
      )}
    </div>
  );
}

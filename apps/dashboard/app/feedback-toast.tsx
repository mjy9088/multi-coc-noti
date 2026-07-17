"use client";

type FeedbackToastProps = {
  error?: string;
  message?: string;
  dismissLabel: string;
  onDismiss: () => void;
};

export default function FeedbackToast({ error = "", message = "", dismissLabel, onDismiss }: FeedbackToastProps) {
  const content = error || message;
  if (!content) return null;

  return <div className={`feedback-toast ${error ? "error" : "success"}`} role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"} aria-atomic="true">
    <span className="feedback-toast-icon" aria-hidden="true">{error ? "!" : "✓"}</span>
    <p>{content}</p>
    <button type="button" className="feedback-toast-close" onClick={onDismiss} aria-label={dismissLabel}>×</button>
  </div>;
}

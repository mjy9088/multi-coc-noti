import type { ResourceStatus } from "@multi-coc/shared";

export type PlannedNotification = {
  kind: "completion" | "one_minute" | "resource_preparation";
  minutesBefore: number;
  preparationMinutes: number | null;
  scheduledAt: Date;
};

export function resolvePreparationMinutes(
  villageMinutes: number | null,
  overrideMinutes: number | null,
): number | null {
  return overrideMinutes === null ? villageMinutes : overrideMinutes === 0 ? null : overrideMinutes;
}

export function planResourceNotifications(
  status: ResourceStatus,
  preparationMinutes: number | null,
  finishAt: string | Date,
  now = new Date(),
): PlannedNotification[] {
  const finish = new Date(finishAt);
  if (status === "abundant")
    return [{ kind: "completion", minutesBefore: 0, preparationMinutes: null, scheduledAt: finish }];
  if (status === "sufficient") {
    const scheduledAt = new Date(finish.getTime() - 60_000);
    return scheduledAt > now ? [{ kind: "one_minute", minutesBefore: 1, preparationMinutes: null, scheduledAt }] : [];
  }
  const result: PlannedNotification[] = [
    { kind: "completion", minutesBefore: 0, preparationMinutes: null, scheduledAt: finish },
  ];
  const preparationAt = preparationMinutes == null ? null : new Date(finish.getTime() - preparationMinutes * 60_000);
  if (preparationMinutes != null && preparationAt && preparationAt > now)
    result.unshift({
      kind: "resource_preparation",
      minutesBefore: preparationMinutes,
      preparationMinutes,
      scheduledAt: preparationAt,
    });
  return result;
}

export function planRefreshNotification(finishAt: string | Date): Date {
  return new Date(new Date(finishAt).getTime() + 24 * 60 * 60_000);
}

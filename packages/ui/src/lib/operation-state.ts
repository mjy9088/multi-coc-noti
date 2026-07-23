export type OperationState<Success = undefined, Failure = string> =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "success"; value: Success }
  | { status: "error"; error: Failure };

export const operationIdle = (): OperationState<never, never> => ({ status: "idle" });
export const operationPending = (): OperationState<never, never> => ({ status: "pending" });
export const operationSucceeded = <Success>(value: Success): OperationState<Success, never> => ({
  status: "success",
  value,
});
export const operationFailed = <Failure>(error: Failure): OperationState<never, Failure> => ({
  status: "error",
  error,
});

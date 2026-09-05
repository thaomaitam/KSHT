export interface SubmitLock {
  begin: () => string | null;
  succeed: () => void;
  failRetryable: () => void;
  failTerminal: () => void;
  readonly inFlight: boolean;
  readonly key: string | undefined;
}

export const createSubmitLock = (): SubmitLock => {
  let inFlight = false;
  let key: string | undefined;
  return {
    begin() {
      if (inFlight) return null;
      inFlight = true;
      if (!key) key = crypto.randomUUID();
      return key;
    },
    succeed() {
      inFlight = false;
      key = undefined;
    },
    failRetryable() {
      inFlight = false;
    },
    failTerminal() {
      inFlight = false;
      key = undefined;
    },
    get inFlight() {
      return inFlight;
    },
    get key() {
      return key;
    },
  };
};

export const stepKey = (operationId: string, step: string): string => `${operationId}:${step}`;

export const isRetryableError = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const record = error as { retryable?: boolean; code?: string; status?: number };
  if (record.retryable) return true;
  return record.code === "OFFLINE" || record.status === 0 || record.status === 429 || record.status === 503;
};

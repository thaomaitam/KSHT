export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "REVISION_CONFLICT",
  "IDEMPOTENCY_CONFLICT",
  "INVALID_TRANSITION",
  "CONFIRMATION_REQUIRED",
  "CONFIRMATION_EXPIRED",
  "CONFIRMATION_STALE",
  "RATE_LIMITED",
  "MIGRATION_READ_ONLY",
  "INTERNAL_ERROR",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly retryable: boolean;
  readonly nextAction?: string;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    options: { retryable?: boolean; nextAction?: string; details?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.nextAction = options.nextAction;
    this.details = options.details;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(this.nextAction ? { nextAction: this.nextAction } : {}),
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export const fail = (
  code: ErrorCode,
  message: string,
  options?: { retryable?: boolean; nextAction?: string; details?: Record<string, unknown> },
): never => {
  throw new DomainError(code, message, options);
};

import { GiabanApplication } from "../application/giaban.ts";
import { operationById } from "../application/registry.ts";
import { DomainError } from "../domain/errors.ts";
import { verifyAssertion, type InvocationContext } from "../safety/assertion.ts";

export interface InvokeEnvelope {
  operationId: string;
  input?: unknown;
  assertion: string;
  idempotencyKey?: string;
  confirmationToken?: string;
  expectedRevision?: number;
  requestId?: string;
}

export const invokeEnvelope = async (
  app: GiabanApplication,
  envelope: InvokeEnvelope,
  secret: string,
  now = new Date(),
) => {
  const principal = await verifyAssertion(secret, envelope.assertion, now);
  const policy = operationById.get(envelope.operationId);
  if (!policy) throw new DomainError("NOT_FOUND", `Unknown operation ${envelope.operationId}`);
  const context: InvocationContext = {
    ...principal,
    requestId: envelope.requestId ?? crypto.randomUUID(),
    now,
    idempotencyKey: envelope.idempotencyKey,
    confirmationToken: envelope.confirmationToken,
    expectedRevision: envelope.expectedRevision,
  };
  return app.invoke(policy.kind, envelope.operationId, envelope.input ?? {}, context);
};

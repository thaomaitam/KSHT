import { fail } from "./errors.ts";

export const normalizePhone = (phone: string): string => phone.replace(/\D+/g, "");

export const maskPhone = (phone: string): string => {
  const digits = normalizePhone(phone);
  if (digits.length < 4) return "***";
  return `${"*".repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
};

export const maskName = (name: string): string => {
  const trimmed = name.trim();
  if (!trimmed) return "***";
  const parts = trimmed.split(/\s+/);
  return parts.map((part) => `${part[0] ?? "*"}***`).join(" ");
};

export const assertCustomerWrite = (input: { name: string; phone: string; address: string }): void => {
  if (!input.name?.trim()) fail("VALIDATION_ERROR", "Customer name is required");
  if (!input.phone?.trim()) fail("VALIDATION_ERROR", "Customer phone is required");
  if (!input.address?.trim()) fail("VALIDATION_ERROR", "Customer address is required");
};

export const duplicatePhoneWarning = (phone: string, otherPhones: string[]): boolean => {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  return otherPhones.some((candidate) => normalizePhone(candidate) === normalized);
};

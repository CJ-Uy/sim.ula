// src/lib/policyTypes.ts
// Shared policy type registry — base types are hardcoded, extras live in localStorage.

export const BASE_POLICY_TYPES = [
  "Ordinance",
  "Executive Order",
  "Plan",
  "Implementing Rules and Regulation",
  "Resolution",
  "Program",
  "Framework",
  "Implementing Rules and Regulations (IRR)",
  "Program/Ordinance",
  "Building Code",
] as const;

const STORAGE_KEY = "simula_custom_policy_types";

export function getCustomTypes(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function saveCustomTypes(types: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(types));
}

export function getAllPolicyTypes(): string[] {
  return [...BASE_POLICY_TYPES, ...getCustomTypes()];
}

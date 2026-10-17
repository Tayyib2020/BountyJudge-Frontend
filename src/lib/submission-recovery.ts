import type { Submission } from "./validation";
import { validateSubmission } from "./validation";

const STORAGE_KEY = "bountyjudge.pending-evaluation.v1";

export type PendingEvaluation = {
  version: 1;
  input: Submission;
  transactionId: string;
  account?: string;
  savedAt: number;
};

const isTransactionId = (value: unknown): value is string => typeof value === "string" && /^0x[\da-f]{64}$/i.test(value);

export function loadPendingEvaluation(storage: Pick<Storage, "getItem"> = window.localStorage): PendingEvaluation | null {
  try {
    const value: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? "null");
    if (!value || typeof value !== "object") return null;
    const candidate = value as Partial<PendingEvaluation>;
    if (candidate.version !== 1 || !candidate.input || validateSubmission(candidate.input) || !isTransactionId(candidate.transactionId) || (candidate.account !== undefined && typeof candidate.account !== "string") || typeof candidate.savedAt !== "number") return null;
    return candidate as PendingEvaluation;
  } catch {
    return null;
  }
}

export function savePendingEvaluation(value: PendingEvaluation, storage: Pick<Storage, "setItem"> = window.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function clearPendingEvaluation(storage: Pick<Storage, "removeItem"> = window.localStorage) {
  storage.removeItem(STORAGE_KEY);
}

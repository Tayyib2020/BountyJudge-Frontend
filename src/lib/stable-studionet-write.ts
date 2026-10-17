import { CONTRACT_ADDRESS } from "./config";
import type { Submission } from "./validation";

/**
 * Browser writes are opt-in for every build mode. This is deliberately a
 * public configuration value: it controls UI availability, not a credential.
 * A missing value keeps both preview and production builds read-only.
 */
export const isStableStudionetWriteEnabled = (value: string | undefined) => value === "true";

export const STABLE_STUDIONET_WRITE_ENABLED =
  isStableStudionetWriteEnabled(import.meta.env.VITE_ENABLE_STUDIONET_WRITES);

/**
 * Matches stable Studio's currently deployed genlayer-js write shape. Stable
 * Studionet accepts this legacy request without a v0.6 `fees` object; adding
 * one would require unsupported fee-policy RPC methods.
 */
export function buildStableStudionetEvaluateRequest(input: Submission) {
  return {
    address: CONTRACT_ADDRESS,
    functionName: "evaluate",
    args: [input.owner, input.repo, input.commitSha],
    value: 0n,
  };
}

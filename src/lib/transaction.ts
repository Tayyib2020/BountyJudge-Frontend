export type TransactionState = "idle" | "awaiting-wallet" | "submitted" | "finalized" | "failed";

export function transactionMessage(state: TransactionState): string {
  return {
    idle: "Ready to prepare an evaluation.",
    "awaiting-wallet": "Waiting for your wallet confirmation.",
    submitted: "Submitted to Studionet; waiting for final consensus.",
    finalized: "Finalized by Studionet consensus.",
    failed: "The transaction did not finalize. No result is presented as persisted.",
  }[state];
}

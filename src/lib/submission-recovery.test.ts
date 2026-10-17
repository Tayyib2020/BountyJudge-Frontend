import { describe, expect, it } from "vitest";
import { clearPendingEvaluation, loadPendingEvaluation, savePendingEvaluation } from "./submission-recovery";

const input = { owner: "lodash", repo: "lodash", commitSha: "8a26eb42adb303f4adc7ef56e300f14c5992aa68" };
const tx = "0x3743d8dfd6fcba0339781fe17dd960f2c1402b27c609318c8890ba877c90cbf6";

function storage() {
  let value: string | null = null;
  return { getItem: () => value, setItem: (_key: string, next: string) => { value = next; }, removeItem: () => { value = null; } };
}

describe("pending evaluation recovery", () => {
  it("restores only a valid, versioned pending transaction", () => {
    const local = storage();
    savePendingEvaluation({ version: 1, input, transactionId: tx, account: "0xabc", savedAt: 1 }, local);
    expect(loadPendingEvaluation(local)).toMatchObject({ input, transactionId: tx });
  });
  it("refuses malformed persisted data", () => {
    const local = { getItem: () => '{"version":1,"transactionId":"bad"}' };
    expect(loadPendingEvaluation(local)).toBeNull();
  });
  it("clears a completed or failed transaction recovery record", () => {
    const local = storage(); savePendingEvaluation({ version: 1, input, transactionId: tx, savedAt: 1 }, local);
    clearPendingEvaluation(local); expect(loadPendingEvaluation(local)).toBeNull();
  });
});

import { describe, expect, it, vi } from "vitest";
import { EvaluationSubmissionController } from "./evaluation-submission";
import { BountyJudgeError, MissingEvaluationError, type TransactionLifecycle } from "./genlayer";
import type { Submission } from "./validation";

const input: Submission = { owner: "lodash", repo: "lodash", commitSha: "8a26eb42adb303f4adc7ef56e300f14c5992aa68" };
const tx = "0x3743d8dfd6fcba0339781fe17dd960f2c1402b27c609318c8890ba877c90cbf6";
const record = { raw: `BJ-001|lodash|lodash|${input.commitSha}|1111`, bountyId: "BJ-001", owner: "lodash", repo: "lodash", commitSha: input.commitSha, r1: true, r2: true, r3: true, passed: true };
const missing = () => Promise.reject(new MissingEvaluationError("missing"));
const finalized: TransactionLifecycle = { phase: "finalized", transactionId: tx, statusName: "FINALIZED", txExecutionResultName: "FINISHED_WITH_RETURN", message: "final" };
function make(overrides: Partial<ConstructorParameters<typeof EvaluationSubmissionController>[0]> = {}) {
  return new EvaluationSubmissionController({
    readEvaluation: vi.fn(missing), connectWallet: vi.fn(async () => "0xabc"), getWalletBalance: vi.fn(async () => 10n),
    submitEvaluation: vi.fn(async () => tx), monitorTransaction: vi.fn(async () => finalized), ...overrides,
  });
}

describe("evaluation submission controller", () => {
  it("rejects malformed submissions before wallet interaction", async () => {
    const controller = make();
    expect((await controller.submit({ ...input, commitSha: "bad" })).phase).toBe("failed");
  });
  it("prevents a duplicate when a finalized record already exists", async () => {
    const submitEvaluation = vi.fn(); const controller = make({ readEvaluation: vi.fn(async () => record), submitEvaluation });
    expect((await controller.submit(input)).phase).toBe("existing"); expect(submitEvaluation).not.toHaveBeenCalled();
  });
  it("handles wallet rejection and wrong-network errors without a transaction", async () => {
    const rejected = make({ connectWallet: vi.fn(async () => { throw new BountyJudgeError("User rejected wallet request."); }) });
    const wrongNetwork = make({ connectWallet: vi.fn(async () => { throw new BountyJudgeError("Connect your wallet to GenLayer Studionet (chain ID 61999)."); }) });
    expect((await rejected.submit(input)).phase).toBe("failed"); expect((await wrongNetwork.submit(input)).message).toMatch(/61999/);
  });
  it("recovers the verified lodash transaction only after finalization and record read", async () => {
    const readEvaluation = vi.fn().mockRejectedValueOnce(new MissingEvaluationError("missing")).mockResolvedValueOnce(record);
    const controller = make({ readEvaluation });
    const state = await controller.submit(input);
    expect(state).toMatchObject({ phase: "finalized", transactionId: tx, record: { passed: true } });
  });
  it("reports accepted as non-final and never displays PASS", async () => {
    const accepted: TransactionLifecycle = { phase: "accepted", transactionId: tx, statusName: "ACCEPTED", message: "accepted" };
    const controller = make({ monitorTransaction: vi.fn(async (_id, onUpdate) => { onUpdate(accepted); return accepted; }) });
    const state = await controller.submit(input);
    expect(state.phase).toBe("accepted"); expect(state.record).toBeUndefined();
  });
  it("keeps a polling limit uncertain and locks the commit", async () => {
    const uncertain: TransactionLifecycle = { phase: "uncertain", transactionId: tx, message: "still pending after ten minutes" };
    const controller = make({ monitorTransaction: vi.fn(async () => uncertain) });
    expect((await controller.submit(input)).phase).toBe("uncertain");
    expect((await controller.submit(input)).phase).toBe("uncertain");
  });
  it("allows a saved transaction to be checked after refresh", async () => {
    const readEvaluation = vi.fn().mockResolvedValue(record);
    const controller = make({ readEvaluation });
    controller.restorePending(input, tx, "0xabc");
    const state = await controller.checkTransactionStatus(input, tx, "0xabc");
    expect(state.phase).toBe("finalized"); expect(state.record?.raw).toBe(record.raw);
  });
  it("does not display a result after finalization failure or RPC uncertainty", async () => {
    const failed: TransactionLifecycle = { phase: "failed", transactionId: tx, statusName: "CANCELED", message: "canceled" };
    const controller = make({ monitorTransaction: vi.fn(async () => failed) });
    expect((await controller.submit(input)).phase).toBe("failed");
    const rpcUnavailable: TransactionLifecycle = { phase: "uncertain", transactionId: tx, message: "RPC unavailable" };
    const uncertain = make({ monitorTransaction: vi.fn(async () => rpcUnavailable) });
    expect((await uncertain.submit(input)).record).toBeUndefined();
  });
  it("does not display PASS when finalization has no persisted or malformed record", async () => {
    const missingRecord = make({ readEvaluation: vi.fn().mockRejectedValue(new MissingEvaluationError("missing")) });
    expect((await missingRecord.submit(input)).phase).toBe("uncertain");
    const malformed = make({ readEvaluation: vi.fn().mockRejectedValue(new BountyJudgeError("malformed evaluation record")) });
    expect((await malformed.submit(input)).phase).toBe("failed");
  });
  it("publishes pending, accepted, and finalized status updates", async () => {
    const pending: TransactionLifecycle = { phase: "pending", transactionId: tx, statusName: "COMMITTING", message: "pending" };
    const accepted: TransactionLifecycle = { phase: "accepted", transactionId: tx, statusName: "ACCEPTED", message: "accepted" };
    const states: string[] = []; const readEvaluation = vi.fn().mockRejectedValueOnce(new MissingEvaluationError("missing")).mockResolvedValueOnce(record);
    const controller = make({ readEvaluation, monitorTransaction: vi.fn(async (_id, onUpdate) => { onUpdate(pending); onUpdate(accepted); return finalized; }) });
    await controller.submit(input, (state) => states.push(state.phase));
    expect(states).toContain("processing"); expect(states).toContain("accepted"); expect(states.at(-1)).toBe("finalized");
  });
});

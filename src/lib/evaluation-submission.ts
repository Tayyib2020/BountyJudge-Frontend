import { MissingEvaluationError, type TransactionLifecycle } from "./genlayer";
import type { EvaluationRecord } from "./record";
import type { Submission } from "./validation";
import { validateSubmission } from "./validation";

export type SubmissionPhase = "idle" | "checking" | "awaiting_wallet" | "submitted" | "processing" | "accepted" | "finalized" | "failed" | "uncertain" | "existing";
export type SubmissionState = {
  phase: SubmissionPhase;
  message: string;
  transactionId?: string;
  account?: string;
  balance?: bigint | null;
  record?: EvaluationRecord;
};

export type EvaluationSubmissionDependencies = {
  readEvaluation: (input: Submission) => Promise<EvaluationRecord>;
  connectWallet: () => Promise<string>;
  getWalletBalance: (address: string) => Promise<bigint | null>;
  submitEvaluation: (input: Submission, account: string) => Promise<string>;
  monitorTransaction: (transactionId: string, onUpdate: (status: TransactionLifecycle) => void) => Promise<TransactionLifecycle>;
};

const initialState: SubmissionState = { phase: "idle", message: "Enter a repository and commit, then review before requesting wallet approval." };

function submissionKey(input: Submission) {
  return `${input.owner.toLowerCase()}/${input.repo.toLowerCase()}@${input.commitSha.toLowerCase()}`;
}

function lifecyclePhase(status: TransactionLifecycle): SubmissionPhase {
  return status.phase === "pending" ? "processing" : status.phase;
}

export class EvaluationSubmissionController {
  private readonly locks = new Set<string>();
  state: SubmissionState = initialState;

  constructor(private readonly dependencies: EvaluationSubmissionDependencies) {}

  private publish(next: SubmissionState, onChange?: (state: SubmissionState) => void) {
    this.state = next;
    onChange?.(next);
  }

  private async verifyFinalRecord(input: Submission, transactionId: string, account: string | undefined, balance: bigint | null | undefined, onChange?: (state: SubmissionState) => void) {
    try {
      const record = await this.dependencies.readEvaluation(input);
      this.locks.delete(submissionKey(input));
      this.publish({ phase: "finalized", message: "Finalized successfully; the stored on-chain record below is the only result displayed.", transactionId, account, balance, record }, onChange);
    } catch (error) {
      this.publish({ phase: "uncertain", message: `The transaction finalized, but the evaluation record is not yet readable: ${error instanceof Error ? error.message : "unknown error"} Check transaction status again; no result is displayed.`, transactionId, account, balance }, onChange);
    }
  }

  private async reconcile(input: Submission, transactionId: string, account: string | undefined, balance: bigint | null | undefined, onChange?: (state: SubmissionState) => void) {
    const lifecycle = await this.dependencies.monitorTransaction(transactionId, (status) => {
      const phase = lifecyclePhase(status);
      this.publish({ phase, message: status.message, transactionId, account, balance }, onChange);
    });
    const phase = lifecyclePhase(lifecycle);
    if (phase === "finalized") {
      await this.verifyFinalRecord(input, transactionId, account, balance, onChange);
    } else if (phase === "failed") {
      this.locks.delete(submissionKey(input));
      this.publish({ phase, message: lifecycle.message, transactionId, account, balance }, onChange);
    } else {
      this.locks.add(submissionKey(input));
      this.publish({ phase, message: lifecycle.message, transactionId, account, balance }, onChange);
    }
  }

  async submit(input: Submission, onChange?: (state: SubmissionState) => void): Promise<SubmissionState> {
    const validation = validateSubmission(input);
    if (validation) {
      this.publish({ phase: "failed", message: validation }, onChange);
      return this.state;
    }
    const key = submissionKey(input);
    if (this.locks.has(key)) {
      this.publish({ phase: "uncertain", message: "This commit already has a pending or uncertain transaction. Check its status before trying again." }, onChange);
      return this.state;
    }
    this.locks.add(key);
    let transactionId: string | undefined;
    let account: string | undefined;
    let balance: bigint | null | undefined;
    try {
      this.publish({ phase: "checking", message: "Checking for an existing finalized evaluation…" }, onChange);
      try {
        const record = await this.dependencies.readEvaluation(input);
        this.locks.delete(key);
        this.publish({ phase: "existing", message: "A finalized evaluation already exists; no wallet transaction was requested.", record }, onChange);
        return this.state;
      } catch (error) {
        if (!(error instanceof MissingEvaluationError)) throw error;
      }

      this.publish({ phase: "awaiting_wallet", message: "Connect a Studionet wallet and review its approval prompt." }, onChange);
      account = await this.dependencies.connectWallet();
      balance = await this.dependencies.getWalletBalance(account);
      transactionId = await this.dependencies.submitEvaluation(input, account);
      this.publish({ phase: "submitted", message: "Wallet transaction submitted. Consensus processing may take several minutes; do not submit this commit again.", transactionId, account, balance }, onChange);
      await this.reconcile(input, transactionId, account, balance, onChange);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown transaction error.";
      if (transactionId) {
        this.locks.add(key);
        this.publish({ phase: "uncertain", message: `Transaction outcome is uncertain: ${message} Keep the transaction hash and check its status; no result is displayed.`, transactionId, account, balance }, onChange);
      } else {
        this.locks.delete(key);
        this.publish({ phase: "failed", message }, onChange);
      }
    }
    return this.state;
  }

  async checkTransactionStatus(input: Submission, transactionId: string, account?: string, onChange?: (state: SubmissionState) => void): Promise<SubmissionState> {
    const validation = validateSubmission(input);
    if (validation) {
      this.publish({ phase: "failed", message: validation, transactionId, account }, onChange);
      return this.state;
    }
    this.locks.add(submissionKey(input));
    this.publish({ phase: "checking", message: "Checking the saved Studionet transaction status…", transactionId, account }, onChange);
    await this.reconcile(input, transactionId, account, undefined, onChange);
    return this.state;
  }

  restorePending(input: Submission, transactionId: string, account: string | undefined, onChange?: (state: SubmissionState) => void) {
    if (validateSubmission(input)) return;
    this.locks.add(submissionKey(input));
    this.publish({ phase: "uncertain", message: "A saved transaction may still finalize. Check its status before submitting this commit again.", transactionId, account }, onChange);
  }
}

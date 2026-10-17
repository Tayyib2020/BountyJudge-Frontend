import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { CHAIN_ID, CONTRACT_ADDRESS } from "./config";
import { parseEvaluationRecord, type EvaluationRecord } from "./record";
import { buildStableStudionetEvaluateRequest, STABLE_STUDIONET_WRITE_ENABLED } from "./stable-studionet-write";
import type { Submission } from "./validation";

type EthereumProvider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
declare global { interface Window { ethereum?: EthereumProvider } }

const readClient = createClient({ chain: studionet });

export class BountyJudgeError extends Error {}
export class MissingEvaluationError extends BountyJudgeError {}

export async function readEvaluation(input: Submission): Promise<EvaluationRecord> {
  let raw: unknown;
  try {
    raw = await readClient.readContract({ address: CONTRACT_ADDRESS, functionName: "get_evaluation", args: [input.owner, input.repo, input.commitSha] });
  } catch (error) {
    throw new BountyJudgeError(`Unable to reach Studionet: ${error instanceof Error ? error.message : "unknown RPC error"}`);
  }
  if (raw === "") throw new MissingEvaluationError("No finalized evaluation record exists for this repository and commit.");
  const record = parseEvaluationRecord(raw);
  if (!record) throw new BountyJudgeError("The contract returned a malformed evaluation record. It has not been displayed as a result.");
  return record;
}

export async function connectWallet(): Promise<string> {
  if (!window.ethereum) throw new BountyJudgeError("No compatible EIP-1193 browser wallet was found.");
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
  const address = accounts[0];
  if (!address) throw new BountyJudgeError("The wallet did not provide an account.");
  const chain = await window.ethereum.request({ method: "eth_chainId" });
  if (typeof chain !== "string" || Number.parseInt(chain, 16) !== CHAIN_ID) throw new BountyJudgeError("Connect your wallet to GenLayer Studionet (chain ID 61999).");
  return address;
}

export async function getWalletBalance(address: string): Promise<bigint | null> {
  if (!window.ethereum) return null;
  try {
    const raw = await window.ethereum.request({ method: "eth_getBalance", params: [address, "latest"] });
    return typeof raw === "string" && /^0x[\da-f]+$/i.test(raw) ? BigInt(raw) : null;
  } catch {
    return null;
  }
}

export type TransactionLifecyclePhase = "pending" | "accepted" | "finalized" | "failed" | "uncertain";
export type TransactionLifecycle = {
  phase: TransactionLifecyclePhase;
  transactionId: string;
  statusName?: string;
  txExecutionResultName?: string;
  message: string;
};

const pendingStatuses = new Set(["PENDING", "PROPOSING", "COMMITTING", "REVEALING", "APPEAL_REVEALING", "APPEAL_COMMITTING", "READY_TO_FINALIZE"]);
const failedStatuses = new Set(["CANCELED", "UNDETERMINED", "VALIDATORS_TIMEOUT", "LEADER_TIMEOUT"]);

export function explorerTransactionUrl(transactionId: string) {
  return `https://explorer-studio.genlayer.com/tx/${transactionId}`;
}

export function classifyTransactionLifecycle(transactionId: string, transaction: { statusName?: unknown; txExecutionResultName?: unknown }): TransactionLifecycle {
  const statusName = typeof transaction.statusName === "string" ? transaction.statusName : undefined;
  const txExecutionResultName = typeof transaction.txExecutionResultName === "string" ? transaction.txExecutionResultName : undefined;

  if (statusName === "FINALIZED") {
    if (txExecutionResultName === "FINISHED_WITH_RETURN") {
      return { phase: "finalized", transactionId, statusName, txExecutionResultName, message: "Consensus finalized the transaction. Verifying the stored evaluation now…" };
    }
    return { phase: "failed", transactionId, statusName, txExecutionResultName, message: `Transaction finalized without successful execution (${txExecutionResultName ?? "unknown"}).` };
  }
  if (statusName === "ACCEPTED") {
    return { phase: "accepted", transactionId, statusName, txExecutionResultName, message: "Consensus accepted the proposal; finalization and the stored record are still pending." };
  }
  if (statusName && failedStatuses.has(statusName)) {
    return { phase: "failed", transactionId, statusName, txExecutionResultName, message: `Transaction reached terminal status ${statusName}. No evaluation result is displayed.` };
  }
  if (statusName && pendingStatuses.has(statusName)) {
    return { phase: "pending", transactionId, statusName, txExecutionResultName, message: `Transaction is ${statusName}. Consensus is still processing it.` };
  }
  return { phase: "uncertain", transactionId, statusName, txExecutionResultName, message: "Studionet returned an unrecognized transaction status. Check again later; no result is displayed." };
}

/** Read the stable SDK's documented transaction representation; no custom RPC is used. */
export async function getTransactionLifecycle(transactionId: string): Promise<TransactionLifecycle> {
  try {
    const transaction = await readClient.getTransaction({ hash: transactionId as unknown as Parameters<typeof readClient.getTransaction>[0]["hash"] });
    return classifyTransactionLifecycle(transactionId, transaction);
  } catch (error) {
    return { phase: "uncertain", transactionId, message: `Unable to check Studionet transaction status: ${error instanceof Error ? error.message : "unknown RPC error"}` };
  }
}

/**
 * Polls the stable SDK's getTransaction action for up to ten minutes. A poll
 * limit never means failure: callers receive an uncertain result they can
 * check again, retaining the transaction hash.
 */
export async function monitorTransactionLifecycle(
  transactionId: string,
  onUpdate?: (status: TransactionLifecycle) => void,
  options: { intervalMs?: number; maxChecks?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<TransactionLifecycle> {
  const intervalMs = options.intervalMs ?? 5_000;
  const maxChecks = options.maxChecks ?? 120;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms)));
  for (let check = 0; check < maxChecks; check += 1) {
    const lifecycle = await getTransactionLifecycle(transactionId);
    onUpdate?.(lifecycle);
    if (lifecycle.phase === "finalized" || lifecycle.phase === "failed" || lifecycle.phase === "uncertain") return lifecycle;
    if (check < maxChecks - 1) await sleep(intervalMs);
  }
  return { phase: "uncertain", transactionId, message: "Consensus is still pending after ten minutes. Keep this transaction hash and check its status again; it has not been marked failed." };
}

/**
 * The legacy request matches the hosted stable Studio path. It intentionally
 * contains no v0.6 fee object because stable Studionet offers no authoritative
 * client-side protocol-fee quote. This guard stays false unless intentionally
 * enabled at build time.
 */
export async function submitEvaluation(input?: Submission, account?: string): Promise<string> {
  if (!STABLE_STUDIONET_WRITE_ENABLED) {
    throw new BountyJudgeError("Browser submissions are disabled for this build. No wallet transaction was requested.");
  }
  if (!input || !account || !window.ethereum) throw new BountyJudgeError("A connected EIP-1193 wallet and complete submission are required.");
  const writeClient = createClient({ chain: studionet, account: account as `0x${string}`, provider: window.ethereum as never });
  return writeClient.writeContract(buildStableStudionetEvaluateRequest(input)) as Promise<string>;
}

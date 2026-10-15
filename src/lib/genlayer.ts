import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { CHAIN_ID, CONTRACT_ADDRESS } from "./config";
import { parseEvaluationRecord, type EvaluationRecord } from "./record";
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

/**
 * Writes remain deliberately unavailable until a measured fee profile / compatible
 * stable estimator is supplied. This prevents a fake or underfunded submission.
 */
export async function submitEvaluation(): Promise<never> {
  throw new BountyJudgeError("Live submission is disabled: this frontend has no measured stable fee profile for BountyJudge’s GitHub and LLM consensus path.");
}


import { useCallback, useEffect, useRef, useState } from "react";
import { CircleAlert, ExternalLink, LoaderCircle, Search, Send, ShieldCheck, Wallet } from "lucide-react";
import { CONTRACT_ADDRESS, CHAIN_ID } from "../lib/config";
import {
  connectWallet,
  explorerTransactionUrl,
  getWalletBalance,
  monitorTransactionLifecycle,
  readEvaluation,
  submitEvaluation,
} from "../lib/genlayer";
import { EvaluationSubmissionController, type SubmissionState } from "../lib/evaluation-submission";
import { clearPendingEvaluation, loadPendingEvaluation, savePendingEvaluation } from "../lib/submission-recovery";
import type { Submission } from "../lib/validation";

const initialInput: Submission = { owner: "", repo: "", commitSha: "" };
const initialState: SubmissionState = { phase: "idle", message: "Enter a repository and commit, then review before requesting wallet approval." };

function phaseTitle(phase: SubmissionState["phase"]) {
  return ({
    idle: "Ready for review",
    checking: "Checking transaction",
    awaiting_wallet: "Waiting for wallet approval",
    submitted: "Transaction submitted",
    processing: "Consensus processing",
    accepted: "Consensus accepted — awaiting finalization",
    finalized: "Finalized and verified",
    existing: "Existing finalized result",
    failed: "Submission stopped",
    uncertain: "Transaction status uncertain",
  } as const)[phase];
}

export function EvaluationSubmissionPanel() {
  const [input, setInput] = useState<Submission>(initialInput);
  const [state, setState] = useState<SubmissionState>(initialState);
  const controller = useRef(new EvaluationSubmissionController({
    readEvaluation,
    connectWallet,
    getWalletBalance,
    submitEvaluation,
    monitorTransaction: monitorTransactionLifecycle,
  })).current;
  const applyState = useCallback((next: SubmissionState, submittedInput: Submission) => {
    setState(next);
    if (next.transactionId && !["finalized", "failed", "existing"].includes(next.phase)) {
      savePendingEvaluation({ version: 1, input: submittedInput, transactionId: next.transactionId, account: next.account, savedAt: Date.now() });
    } else if (["finalized", "failed", "existing"].includes(next.phase)) {
      clearPendingEvaluation();
    }
  }, []);

  useEffect(() => {
    const pending = loadPendingEvaluation();
    if (!pending) return;
    setInput(pending.input);
    controller.restorePending(pending.input, pending.transactionId, pending.account, (next) => applyState(next, pending.input));
  }, [applyState, controller]);

  const busy = ["checking", "awaiting_wallet", "submitted", "processing", "accepted"].includes(state.phase);
  const submissionBlocked = busy || state.phase === "finalized" || state.phase === "existing" || state.phase === "uncertain";
  const canCheck = Boolean(state.transactionId) && !busy && ["uncertain", "submitted", "processing", "accepted"].includes(state.phase);
  const update = (field: keyof Submission, value: string) => setInput((current) => ({
    ...current,
    [field]: field === "commitSha" ? value.toLowerCase() : value,
  }));
  async function onSubmit() {
    await controller.submit(input, (next) => applyState(next, input));
  }
  async function onCheckStatus() {
    if (!state.transactionId) return;
    await controller.checkTransactionStatus(input, state.transactionId, state.account, (next) => applyState(next, input));
  }

  return <section className="submit-panel experimental-submit-panel">
    <div className="panel-heading">
      <span className="section-number">02</span>
      <div>
        <h2>Submit a new evaluation</h2>
        <p>Check the exact commit, connect a Studionet wallet, review the request, approve it yourself, then wait for consensus finalization.</p>
      </div>
    </div>
    <div className="write-gate fee-disclosure"><CircleAlert size={20}/><div><strong>No authoritative maximum protocol-fee quote is available.</strong><p>This stable-Studionet request path is not described as gasless or free. Review the wallet prompt and any displayed costs before approving.</p></div></div>
    <div className="form-grid submission-fields">
      <label>Repository owner<input value={input.owner} onChange={(event) => update("owner", event.target.value)} placeholder="psf" disabled={submissionBlocked}/></label>
      <label>Repository name<input value={input.repo} onChange={(event) => update("repo", event.target.value)} placeholder="requests" disabled={submissionBlocked}/></label>
    </div>
    <label>Full commit SHA<input className="mono" value={input.commitSha} onChange={(event) => update("commitSha", event.target.value)} placeholder="40-character hexadecimal commit SHA" disabled={submissionBlocked}/></label>
    <div className="submission-review" aria-label="Submission review">
      <span>Contract <code>{CONTRACT_ADDRESS}</code></span>
      <span>Network <b>Studionet · {CHAIN_ID}</b></span>
      <span>Repository <b>{input.owner || "—"}/{input.repo || "—"}</b></span>
      <span>Commit <code>{input.commitSha || "—"}</code></span>
    </div>
    <div className={`transaction-state state-${state.phase}`} role="status" aria-live="polite">
      {busy ? <LoaderCircle className="spin" size={19}/> : state.phase === "finalized" ? <ShieldCheck size={19}/> : <Wallet size={19}/>}<div><strong>{phaseTitle(state.phase)}</strong>{state.message && <p>{state.message}</p>}{state.transactionId && <><code>{state.transactionId}</code><a className="transaction-link" href={explorerTransactionUrl(state.transactionId)} target="_blank" rel="noreferrer">View transaction in Studio Explorer <ExternalLink size={14}/></a></>}{state.record && <p>Verified on-chain result: <b>{state.record.passed ? "PASSED" : "FAILED"}</b> (R1 {state.record.r1 ? "PASS" : "FAIL"}, R2 {state.record.r2 ? "PASS" : "FAIL"}, R3 {state.record.r3 ? "PASS" : "FAIL"}).</p>}</div>
    </div>
    <div className="form-actions">
      <button className="button primary" onClick={onSubmit} disabled={submissionBlocked}><Send size={17}/>Review and request wallet approval</button>
      {canCheck && <button className="button secondary" onClick={onCheckStatus}><Search size={17}/>Check transaction status</button>}
    </div>
    {state.phase === "uncertain" && <p className="uncertain-note">Do not retry automatically. This saved transaction may still finalize; check its status and the on-chain record first.</p>}
  </section>;
}

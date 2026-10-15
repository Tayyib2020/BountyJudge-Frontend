import { afterEach, describe, expect, it } from "vitest";
import { BountyJudgeError, connectWallet, submitEvaluation } from "./genlayer";

const originalEthereum = window.ethereum;

afterEach(() => { window.ethereum = originalEthereum; });

describe("wallet and write safety gates", () => {
  it("rejects a missing browser wallet", async () => {
    window.ethereum = undefined;
    await expect(connectWallet()).rejects.toThrow("No compatible EIP-1193");
  });

  it("rejects a wallet on a non-Studionet chain", async () => {
    window.ethereum = { request: async ({ method }) => method === "eth_requestAccounts" ? ["0x123"] : "0x1" };
    await expect(connectWallet()).rejects.toThrow("chain ID 61999");
  });

  it("does not provide a hidden write fallback without a fee profile", async () => {
    await expect(submitEvaluation()).rejects.toBeInstanceOf(BountyJudgeError);
  });
});

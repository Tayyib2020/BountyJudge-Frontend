import { describe, expect, it } from "vitest";
import { transactionMessage } from "./transaction";
describe("transaction lifecycle", () => { it("does not label submitted as finalized", () => expect(transactionMessage("submitted")).toMatch(/waiting/i)); it("makes final and failure states explicit", () => { expect(transactionMessage("finalized")).toMatch(/Finalized/); expect(transactionMessage("failed")).toMatch(/did not finalize/); }); });

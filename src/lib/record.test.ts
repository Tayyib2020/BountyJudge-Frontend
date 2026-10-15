import { describe, expect, it } from "vitest";
import { parseEvaluationRecord } from "./record";
const prefix = "BJ-001|psf|requests|611c6162cbc4ac2020a2f91c7cfa4f3abf9bbb60|";
describe("evaluation-record parsing", () => { it("parses documented 1111", () => expect(parseEvaluationRecord(`${prefix}1111`)).toMatchObject({r1:true,r2:true,r3:true,passed:true})); it("parses a valid fail", () => expect(parseEvaluationRecord(`${prefix}1100`)).toMatchObject({r1:true,r2:true,r3:false,passed:false})); it("rejects malformed or inconsistent records", () => {expect(parseEvaluationRecord(`${prefix}1110`)).toBeNull();expect(parseEvaluationRecord(`${prefix}nope`)).toBeNull();expect(parseEvaluationRecord(42)).toBeNull();}); });

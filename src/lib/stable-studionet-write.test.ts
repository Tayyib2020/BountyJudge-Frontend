import { describe, expect, it } from "vitest";
import { CONTRACT_ADDRESS } from "./config";
import {
  buildStableStudionetEvaluateRequest,
  isStableStudionetWriteEnabled,
  STABLE_STUDIONET_WRITE_ENABLED,
} from "./stable-studionet-write";

describe("stable Studionet write compatibility path", () => {
  it("is disabled when the explicit production flag is absent and enabled only by true", () => {
    expect(isStableStudionetWriteEnabled(undefined)).toBe(false);
    expect(isStableStudionetWriteEnabled("false")).toBe(false);
    expect(isStableStudionetWriteEnabled("true")).toBe(true);
    expect(typeof STABLE_STUDIONET_WRITE_ENABLED).toBe("boolean");
  });

  it("matches Studio's legacy evaluate write shape without a fabricated fee object", () => {
    const request = buildStableStudionetEvaluateRequest({
      owner: "owner",
      repo: "repo",
      commitSha: "a".repeat(40),
    });

    expect(request).toEqual({
      address: CONTRACT_ADDRESS,
      functionName: "evaluate",
      args: ["owner", "repo", "a".repeat(40)],
      value: 0n,
    });
    expect("fees" in request).toBe(false);
  });
});

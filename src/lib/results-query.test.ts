import { describe, expect, it } from "vitest";
import { submissionFromResultsSearch } from "./results-query";

describe("results query", () => {
  it("returns an empty state for a bare /results route", () => expect(submissionFromResultsSearch("")).toBeNull());
  it("preserves supplied values for validation by the results route", () => expect(submissionFromResultsSearch("?owner=psf&repo=requests&commit=bad")).toEqual({ owner: "psf", repo: "requests", commitSha: "bad" }));
});

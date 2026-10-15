import type { Submission } from "./validation";

export function submissionFromResultsSearch(search: string): Submission | null {
  const query = new URLSearchParams(search);
  const input = { owner: query.get("owner") ?? "", repo: query.get("repo") ?? "", commitSha: query.get("commit") ?? "" };
  return input.owner === "" && input.repo === "" && input.commitSha === "" ? null : input;
}

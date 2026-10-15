export type Submission = { owner: string; repo: string; commitSha: string };
const IDENTIFIER = /^[A-Za-z0-9_.-]{1,100}$/;
const SHA = /^[a-fA-F0-9]{40}$/;

export const isIdentifier = (value: string) => IDENTIFIER.test(value);
export const isFullSha = (value: string) => SHA.test(value);

export function validateSubmission(input: Submission): string | null {
  if (!isIdentifier(input.owner)) return "Use a valid GitHub owner.";
  if (!isIdentifier(input.repo)) return "Use a valid repository name.";
  if (!isFullSha(input.commitSha)) return "Enter a full 40-character hexadecimal commit SHA.";
  return null;
}

export function parseGithubCommitUrl(value: string): Submission | null {
  const match = value.trim().match(/^https?:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/commit\/([a-fA-F0-9]{40})\/?$/i);
  return match ? { owner: match[1], repo: match[2], commitSha: match[3].toLowerCase() } : null;
}


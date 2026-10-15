export type EvaluationRecord = {
  raw: string; bountyId: string; owner: string; repo: string; commitSha: string;
  r1: boolean; r2: boolean; r3: boolean; passed: boolean;
};

export function parseEvaluationRecord(raw: unknown): EvaluationRecord | null {
  if (typeof raw !== "string") return null;
  const parts = raw.split("|");
  if (parts.length !== 5) return null;
  const [bountyId, owner, repo, commitSha, flags] = parts;
  if (bountyId !== "BJ-001" || !/^[A-Za-z0-9_.-]{1,100}$/.test(owner) || !/^[A-Za-z0-9_.-]{1,100}$/.test(repo) || !/^[a-f0-9]{40}$/.test(commitSha) || !/^[01]{4}$/.test(flags)) return null;
  const [r1, r2, r3, passed] = [...flags].map((item) => item === "1");
  if (passed !== (r1 && r2 && r3)) return null;
  return { raw, bountyId, owner, repo, commitSha, r1, r2, r3, passed };
}


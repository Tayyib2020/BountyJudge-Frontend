# BountyJudge

BountyJudge is a GenLayer Intelligent Contract and read-only web interface for
the fixed **BJ-001 Developer Documentation Challenge**. A developer submits a
public GitHub owner, repository, and full 40-character commit SHA. The
contract assesses that exact immutable snapshot, obtains validator consensus,
and stores a compact final record.

The live interface is [bounty-judge-frontend.vercel.app](https://bounty-judge-frontend.vercel.app/).
It reads the real deployed contract without a wallet.

## Reviewer quick links

| Item | Location |
| --- | --- |
| Contract implementation included with this submission | [`contracts/BountyJudge.py`](contracts/BountyJudge.py) |
| Contract ABI | [`contracts/BountyJudge.abi.json`](contracts/BountyJudge.abi.json) |
| Direct Mode contract tests | [`contracts/tests/test_bounty_judge.py`](contracts/tests/test_bounty_judge.py) |
| Detailed implementation notes | [`docs/CONTRACT.md`](docs/CONTRACT.md) |
| Authoritative contract repository | [Tayyib2020/BountyJudge](https://github.com/Tayyib2020/BountyJudge) |
| Frontend repository | [Tayyib2020/BountyJudge-Frontend](https://github.com/Tayyib2020/BountyJudge-Frontend) |
| Deployed contract | [`0xCDad3962e66C6aEeFedAbe0848477F712F3902b7`](https://explorer-studio.genlayer.com/address/0xCDad3962e66C6aEeFedAbe0848477F712F3902b7) |

The original contract repository remains authoritative. The source copy in
this repository is intentionally included so a Portal reviewer can inspect the
actual implementation alongside the web application. Its SHA-256 is:

```text
AE0D2344D2C30CEF06CF7F779B63E83ADD6A40FAB9743B313EAC5907C058044A
```

## Why GenLayer

BJ-001 requires public-web evidence and a semantic determination: whether the
pinned README contains actionable setup or run instructions. A conventional
smart contract cannot retrieve GitHub files or independently assess that
semantic requirement. The GenLayer Intelligent Contract does both under the
Equivalence Principle: validators independently retrieve the same pinned
evidence and verify the proposed outcome before state is written.

## Contract and network

- **Network:** GenLayer Studionet
- **Chain ID:** `61999`
- **RPC:** `https://studio.genlayer.com/api`
- **Contract:** `0xCDad3962e66C6aEeFedAbe0848477F712F3902b7`
- **Bounty:** `BJ-001` — Developer Documentation Challenge

The public ABI intentionally has two methods:

```text
evaluate(owner: string, repo: string, commit_sha: string) -> string
get_evaluation(owner: string, repo: string, commit_sha: string) -> string
```

## How evaluation works

`evaluate(owner, repo, commit_sha)` validates the owner, repository, and full
SHA before constructing raw GitHub URLs pinned to that SHA:

```text
https://raw.githubusercontent.com/<owner>/<repo>/<commit_sha>/README.md
https://raw.githubusercontent.com/<owner>/<repo>/<commit_sha>/LICENSE
```

It then applies the fixed rubric:

1. **R1 — README:** `README.md` must exist and be nonempty.
2. **R2 — LICENSE:** `LICENSE` must exist and be nonempty. This does not claim
   that the license is legally valid.
3. **R3 — setup instructions:** the README is evaluated only for concrete setup
   or execution guidance: commands, installation, configuration, dependency
   installation, or similarly actionable instructions. Marketing claims do not
   satisfy R3.

GitHub `404` makes the relevant file absent. Rate limits, server errors, and
other non-`200` responses fail closed without a stored result. README content
is untrusted data, delimited in the narrowly scoped R3 prompt, and never
treated as evaluator instructions. Malformed LLM responses and inconclusive R3
evidence also fail closed.

## Independent validation and storage

The leader obtains evidence and proposes four boolean flags: `r1`, `r2`, `r3`,
and `passed`. In `validator_fn`, validators do **not** accept that proposal by
shape alone. Each validator re-fetches `README.md` and `LICENSE` at the
submitted SHA, recomputes R1/R2, independently assesses R3 against the same
rubric, and rejects unsupported PASS or FAIL decisions. Different explanatory
wording is immaterial; the source-grounded boolean decision is what is checked.

Only an accepted consensus result is encoded and written to the `TreeMap`.
Records use this deterministic format:

```text
BJ-001|owner|repo|commit_sha|R1R2R3PASS
```

`get_evaluation()` validates the same inputs and returns that stored string, or
an empty string when no finalized record exists. A missing record is neither a
PASS nor a FAIL.

## Reproducible read-only example

The following previously observed, stored record is available for inspection:

```text
owner:      psf
repository: requests
commit:     611c6162cbc4ac2020a2f91c7cfa4f3abf9bbb60
record:     BJ-001|psf|requests|611c6162cbc4ac2020a2f91c7cfa4f3abf9bbb60|1111
```

The flags mean R1, R2, R3, and the overall result all passed. Verify the
evidence at the [pinned GitHub commit](https://github.com/psf/requests/commit/611c6162cbc4ac2020a2f91c7cfa4f3abf9bbb60), or use the live
[results page](https://bounty-judge-frontend.vercel.app/results?owner=psf&repo=requests&commit=611c6162cbc4ac2020a2f91c7cfa4f3abf9bbb60).

No reliable transaction hash for this historical example is included here; one
is not inferred from the stored record.

## Reproduce with GenLayer Studio

1. Open [GenLayer Studio](https://studio.genlayer.com/) and select stable
   **Studionet** (chain ID `61999`).
2. Open the deployed contract address above and inspect its two-method ABI.
3. Use the read-only `get_evaluation` call with the example owner, repository,
   and SHA to retrieve the `1111` record.
4. To submit a new `evaluate` call, use Studio's supported transaction flow,
   provide a public repository and a full SHA, and review the account, network,
   and any fee/deposit prompt before signing. Do not assume a zero protocol fee.
5. Wait for finalization, then call `get_evaluation` using the same arguments.

## Local verification

The bundled contract tests are copied from the authoritative contract project
for review. To run them, use Python 3.12+ and the GenLayer packages listed in
[`contracts/requirements.txt`](contracts/requirements.txt):

```powershell
python -m pip install -r contracts/requirements.txt
pytest contracts/tests/test_bounty_judge.py -v
genvm-lint check contracts/BountyJudge.py
```

For the frontend:

```powershell
npm ci
npm test
npm run lint
npm run build
```

## Status and limitations

- The deployed contract, Studio execution history, consensus behavior, stored
  evaluation format, and wallet-free frontend reads are the demonstrated parts
  of the project.
- Browser-wallet submission code is experimental and is **not** claimed here as
  a verified finalized browser-wallet evaluation.
- BJ-001 does not validate license legality, private repositories, alternate
  filenames, dependency safety, or deployed application behavior.
- This repository contains no private keys, wallets, `.env` values, dependency
  directories, build outputs, or caches.

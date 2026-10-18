# BountyJudge contract review notes

The implementation copied into [`../contracts/BountyJudge.py`](../contracts/BountyJudge.py)
is a byte-identical review copy of the source in the authoritative
[BountyJudge contract repository](https://github.com/Tayyib2020/BountyJudge).
It is included in this frontend repository solely to make the Portal
submission self-contained and inspectable.

## Public interface

`evaluate(owner, repo, commit_sha)` is a public write method. It is idempotent
per normalized `owner/repo@sha`: an existing stored record is returned rather
than producing another consensus evaluation.

`get_evaluation(owner, repo, commit_sha)` is a public view method. It returns
only a finalized record; it never manufactures a default result.

The ABI in [`../contracts/BountyJudge.abi.json`](../contracts/BountyJudge.abi.json)
contains exactly those methods, each with three string inputs and a string
return value.

## Evidence boundary

`_source_url` derives raw GitHub URLs from a validated owner, repo, exact
40-character SHA, and a fixed filename. `_read_pinned_file` accepts only HTTP
200 or an objective missing-file HTTP 404. It raises on rate limiting or
temporary failures so no incorrect result can be persisted.

## Consensus boundary

`gl.vm.run_nondet_unsafe(leader_fn, validator_fn)` is deliberately used for
GitHub access and LLM assessment. The validator independently reloads evidence
and reassesses R3. It compares objective checks and the source-grounded R3
boolean, not free-form LLM support text. This is why a forged leader PASS or
FAIL cannot be accepted merely because it is valid JSON.

## Storage boundary

`_encode_record` produces the compact record only after an accepted,
schema-valid consensus result. The state write occurs at the end of `evaluate`,
after all evidence, model, and validator checks have completed.

## Tests

The Direct Mode suite exercises SHA pinning, 404 vs. 429/5xx behavior, prompt
injection handling, malformed LLM output, inconclusive setup evidence,
validator disagreement, duplicate idempotency, unsupported leader decisions,
and no-write behavior on failure. Its Windows fixture enables strict mocks and
pickling checks.

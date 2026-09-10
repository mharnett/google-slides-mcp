# Reconciliation record — 2026-09

`fork/main` (`mharnett/google-slides-mcp`) had diverged 9 commits ahead / 8
commits behind `origin/main` (`matteoantoci/google-slides-mcp`), merge-base
`4f4c1c575`. This records the classification and the decision.

## Open Question 1 — commit classification

Read `git diff 4f4c1c575 origin/main`, `git diff 4f4c1c575 fork/main`, and
upstream ADRs 0007/0008/0010 before classifying. Upstream's 8 commits
(`0b888f0` back to `e6eecec`) amount to a rewrite of the server around a new
MCP SDK package, a keychain/file token store with interactive consent
(ADR 0010), `unknown`-typed tool boundaries (ADR 0008), and per-tool-file
modules (ADR 0007) — none of which existed at the merge-base.

| Commit | Subject | Classification | Reason |
|---|---|---|---|
| `2d9a58b` | Add build fingerprint to startup log | Superseded | Wires into the old `src/index.ts` (`Server`/`StdioServerTransport`/`checkEnvironmentVariables`), all of which upstream deleted; the feature has no seam to attach to without a rewrite. |
| `2ed81bc` | Add typed errors, error module, 31 tests | Superseded | `validateCredentials()` checks `GOOGLE_CLIENT_ID`/`_SECRET`/`_REFRESH_TOKEN` env vars that no longer exist upstream (replaced by `auth/tokenStore.ts` + `resolveCredential.ts`); upstream's own `errorHandler.ts` moved to `ProtocolError`/`ProtocolErrorCode` from the new SDK package, which this module doesn't use. |
| `302faac` | Extract tools to separate module + 4 contract tests | Superseded | Upstream's ADR 0007 already extracted tools, one file per tool exporting name/descriptor/handler — a different, incompatible shape from this fork's single `src/tools.ts`. |
| `ad429f2` | Resilience layer: retry + circuit breaker + truncation | Superseded (concept re-derivable) | The retry/circuit-breaker/truncation logic in `resilience.ts` itself doesn't collide with anything upstream added (upstream has no resilience layer), but its two integration points — `src/index.ts` and `src/utils/errorHandler.ts` — are both wholesale-rewritten upstream (old `McpError`/`ErrorCode` from `@modelcontextprotocol/sdk/types.js` no longer exists), so it can't be cherry-picked; it would need to be re-authored against the new error/logging surface. |
| `a092eaa` | Add MCP healthcheck smoke test | Superseded (concept re-derivable) | `scripts/healthcheck.sh` itself is a thin, source-independent wrapper, but it shells out to `run-mcp.sh`, which is written against this fork's env-var/Keychain credential flow, not upstream's token-store flow. |
| `f58cfce` | Tighten resilience test assertions | Superseded | Only touches `resilience.test.ts`, which depends on `ad429f2`; falls with it. |
| `492ddfc` | OAuth onboarding decoupling (PKCE helper, config-driven scope) | Superseded | Upstream's ADR 0010 (keychain-then-file token store + built-in consent pages, `src/auth/*`) replaces the standalone `get-refresh-token.cjs`/`authCli.ts` flow entirely; different architecture, not a smaller version of it. |
| `2b97763` | Lock runtime authCli path (import-safety/PKCE/scope/env tests) | Superseded | Tests exercise the code `492ddfc` added; falls with it. |
| `8af8bf1` | Merge PR #1 (oauth-decouple-template) | Superseded | Merge commit for `492ddfc` + `2b97763`; no independent content. |

**All 9 commits are superseded** — none survive as a clean cherry-pick or
small adaptation onto `origin/main`. (Earlier working assumption favored a
"still-additive, rebase surviving commits" path; reading the actual diffs
changed that — the 4 candidates that looked additive by subject line all
turned out to be wired into files upstream rewrote wholesale.)

## Open Question 2 — reconciliation path chosen: **(b) stay on fork/main**

Rebasing/cherry-picking is not "resolve conflicts as they arise" — it's
re-implementing 9 commits' worth of feature work (typed errors, resilience,
OAuth decoupling, tool extraction) from scratch against three areas upstream
rewrote independently, verified against upstream's own architecture rather
than this fork's. That is larger than the value of the 9 commits. Per the
task's own fallback ("if rebase conflicts prove larger than the value of the
9 local commits, that is a legitimate finding — record it and switch to the
stay-on-fork path"), this fork stays on `fork/main` at `8af8bf1` and stops
treating `origin/main` as a live comparison. See `CLAUDE.md` for the
authority statement this implies.

**DoD 2 and 4–5 waiver:** since the chosen path is stay-on-fork rather than a
merge, "the reconciled tree" is `fork/main` itself — there is no separate
merged tree to run tests or a healthcheck against beyond what already exists
on `fork/main`. The healthcheck (`npm run smoke` /
`scripts/healthcheck.sh`) was **not run live** by this change: it shells out
to `run-mcp.sh`, which reads real Google OAuth credentials from the macOS
Keychain and exchanges them with Google's token endpoint — out of scope for
an automated doc-only change. `npm test` was run against `fork/main`
(`8af8bf1`) directly (not through this PR's diff, which touches no source):
10 files, 84 tests, all passing — matching the baseline (31 error tests in
`src/errors.test.ts`, 4 contract tests in `src/tools.contract.test.ts`, plus
`get-refresh-token.test.mjs` (11), `no-local-paths.guard.test.mjs` (4),
`pkce-parity.test.mjs` (4), `oauthScope.test.ts` (7), `pkce.test.ts` (6),
`scope-parity.test.mjs` (5), `authCli.test.ts` (5), `resilience.test.ts` (7)).
No test was dropped — this is documentation only, added on top of
`fork/main` unchanged.

## Open Question 3 — audit other vendored MCPs: **(a), follow-up filed**

See `## Requested follow-ups` in the PR this ships with.

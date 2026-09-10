## Remotes and branch authority

This checkout is a hard fork, not a tracking fork:

- `fork` → `mharnett/google-slides-mcp` — **authoritative.** `fork/main` is the
  branch that ships and that CI/healthchecks run against. Work lands here via
  PR, base `main`.
- `origin` → `matteoantoci/google-slides-mcp` — the upstream vendor. It is kept
  as a read-only reference remote for occasional diffing, not as a merge
  target. `origin/main` is **not** tracked by `main` for ahead/behind
  purposes; do not treat `git status`'s ahead/behind count against `origin` as
  a to-do list.

Why: upstream rewrote the server around a different MCP SDK package
(`@modelcontextprotocol/server` + `McpServer`/`serveStdio` vs. this fork's
`@modelcontextprotocol/sdk` + `Server`/`StdioServerTransport`), a different
credential model (keychain/file `tokenStore` + interactive consent pages vs.
this fork's env-var creds + standalone `get-refresh-token.cjs`/`authCli.ts`
PKCE flow), and a different tool-module layout (`src/tools/*.ts` one file per
tool vs. this fork's single `src/tools.ts`). Every one of this fork's 9
locally-diverged commits touches one of those three rewritten areas, so a
literal rebase onto `origin/main` would mean re-deriving each feature against
unfamiliar upstream internals rather than replaying a patch. See
`docs/reconciliation-2026-09.md` for the commit-by-commit classification and
the decision record.

If a future sync is attempted, do it feature-by-feature against
`origin/main`, not as a bulk rebase/merge of `fork/main`.

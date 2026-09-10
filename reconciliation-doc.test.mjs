import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Locks DoD 3 of the "our fork has diverged from it" reconciliation task:
// the checkout's branch/remote authority must be stated explicitly in a
// CLAUDE.md or README note, regardless of whether the rebase/merge path was
// executed or the stay-on-fork path was chosen instead.

describe('remote authority note', () => {
  it('CLAUDE.md names fork as the authoritative remote and origin as reference-only', () => {
    const text = readFileSync(new URL('./CLAUDE.md', import.meta.url), 'utf8');
    expect(text).toMatch(/mharnett\/google-slides-mcp/);
    expect(text).toMatch(/matteoantoci\/google-slides-mcp/);
    expect(text).toMatch(/authoritative/i);
  });

  it('the reconciliation record classifies all 9 locally-diverged commits and states the chosen path', () => {
    const text = readFileSync(new URL('./docs/reconciliation-2026-09.md', import.meta.url), 'utf8');
    const commits = ['2d9a58b', '2ed81bc', '302faac', 'ad429f2', 'a092eaa', 'f58cfce', '492ddfc', '2b97763', '8af8bf1'];
    for (const sha of commits) {
      expect(text).toContain(sha);
    }
    expect(text).toMatch(/stay on fork\/main/i);
  });
});

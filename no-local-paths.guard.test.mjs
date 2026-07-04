// ============================================
// CI guard: the SHIPPED surface must contain no absolute /Users/mark path
// and no gcp-oauth (shared OAuth-client) reference.
// ============================================
// "Shipped surface" = the standalone onboarding helper + source + docs +
// example config: get-refresh-token.cjs, src/** (excluding tests), README.md,
// config.example.json.
//
// The SHIPPED build output (build/**/*.js, *.d.ts, and build/build-info.json) is
// ALSO scanned: a forbidden string can be injected at build time (e.g. a path
// baked into build-info.json) and would evade a src-only guard. Compiled test
// files (build/**/*.test.js) are skipped.
//
// Deliberately EXCLUDED: node_modules, .git, *.test.* / *.guard.* files, and
// Mark's PRIVATE launcher scripts (run-mcp.sh, scripts/healthcheck.sh) which
// carry a /Users/mark path by design; the guard asserts separately that they
// are not in the publish allowlist.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = __dirname;

const FORBIDDEN = [/\/Users\/mark/, /gcp-oauth/];

const SKIP_DIRS = new Set(['node_modules', '.git', 'build', 'dist', 'scripts', '.github']);

function isTestOrGuard(file) {
  return /\.(test|guard)\.(m?[jt]s|cjs)$/.test(file);
}

// Walk only files that are part of the shipped surface.
function shippedFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const rel = path.relative(REPO, full);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      out.push(...shippedFiles(full));
      continue;
    }
    if (isTestOrGuard(entry)) continue;
    if (entry === 'config.json') continue; // gitignored/per-user, not shipped
    const shippable =
      full === path.join(REPO, 'get-refresh-token.cjs') ||
      full === path.join(REPO, 'README.md') ||
      full === path.join(REPO, 'config.example.json') ||
      rel.startsWith('src' + path.sep);
    if (shippable) out.push(full);
  }
  return out;
}

// Walk the SHIPPED build output: build/**/*.{js,d.ts} + build/build-info.json,
// excluding compiled test files.
function shippedBuildFiles(buildDir) {
  if (!existsSync(buildDir)) return [];
  const out = [];
  for (const entry of readdirSync(buildDir)) {
    const full = path.join(buildDir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...shippedBuildFiles(full));
      continue;
    }
    if (/\.test\.(m?js|cjs)$/.test(entry) || /\.test\.d\.ts$/.test(entry)) continue;
    if (entry.endsWith('.js') || entry.endsWith('.d.ts') || entry === 'build-info.json') {
      out.push(full);
    }
  }
  return out;
}

function scanForForbidden(files) {
  const hits = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf-8');
    src.split('\n').forEach((line, i) => {
      for (const re of FORBIDDEN) {
        if (re.test(line)) hits.push(`${path.relative(REPO, file)}:${i + 1}  ${line.trim()}`);
      }
    });
  }
  return hits;
}

describe('shipped surface has no local /Users/mark paths or gcp-oauth references', () => {
  const files = shippedFiles(REPO);

  it('scans a non-trivial set of files (guard is not vacuous)', () => {
    expect(files.length).toBeGreaterThan(5);
    expect(files.some((f) => f.endsWith('get-refresh-token.cjs'))).toBe(true);
    expect(files.some((f) => f.endsWith('README.md'))).toBe(true);
  });

  it('contains no forbidden string in any shipped source/doc file', () => {
    const hits = scanForForbidden(files);
    expect(hits, `Forbidden strings in shipped surface:\n${hits.join('\n')}`).toEqual([]);
  });

  it('contains no forbidden string in the SHIPPED build output (build/**)', () => {
    const buildFiles = shippedBuildFiles(path.join(REPO, 'build'));
    expect(
      buildFiles.some((f) => f.endsWith('build-info.json')),
      'build not present (run `npm run build`) — cannot verify shipped build output'
    ).toBe(true);
    const hits = scanForForbidden(buildFiles);
    expect(hits, `Forbidden strings in shipped build:\n${hits.join('\n')}`).toEqual([]);
  });

  it('private launcher scripts carrying /Users/mark are NOT in the npm publish allowlist', () => {
    const pkg = JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf-8'));
    const allow = (pkg.files || []).join('\n');
    for (const priv of ['run-mcp.sh', 'scripts/healthcheck.sh']) {
      if (existsSync(path.join(REPO, priv))) {
        expect(allow).not.toContain(priv);
      }
    }
    expect(allow).not.toMatch(/\.sh(\s|$)/);
  });
});

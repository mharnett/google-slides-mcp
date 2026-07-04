// ============================================
// Runtime OAuth scope resolution.
// ============================================
// The Google Slides OAuth scope requested at auth time lives in config.json
// under `oauth.scope`. It falls back to the committed minimum scope when
// config.json is absent/unparseable. config.example.json must NEVER influence
// the resolved scope.

import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import {
  DEFAULT_SLIDES_SCOPE,
  normalizeScope,
  resolveOAuthScope,
  loadOAuthScopeFromFile,
} from './oauthScope.js';

function stage(files: Record<string, unknown>): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'slides-scope-'));
  for (const [name, obj] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), JSON.stringify(obj));
  }
  return dir;
}

describe('DEFAULT_SLIDES_SCOPE is min-scope', () => {
  it('is exactly the presentations read/write scope, nothing more', () => {
    expect(DEFAULT_SLIDES_SCOPE).toBe('https://www.googleapis.com/auth/presentations');
    // No drive scope leaked into the default.
    expect(DEFAULT_SLIDES_SCOPE).not.toContain('drive');
  });
});

describe('normalizeScope', () => {
  it('collapses comma/space/newline lists to a single space-separated string', () => {
    expect(normalizeScope('a,b\n c')).toBe('a b c');
    expect(normalizeScope('  a   b  ')).toBe('a b');
    expect(normalizeScope('')).toBe('');
  });
});

describe('resolveOAuthScope (parsed object)', () => {
  it('uses oauth.scope when present', () => {
    expect(resolveOAuthScope({ oauth: { scope: 'https://scope/x' } })).toBe('https://scope/x');
  });
  it('falls back to default when oauth.scope missing/empty/non-string', () => {
    expect(resolveOAuthScope({})).toBe(DEFAULT_SLIDES_SCOPE);
    expect(resolveOAuthScope({ oauth: { scope: '' } })).toBe(DEFAULT_SLIDES_SCOPE);
    expect(resolveOAuthScope({ oauth: { scope: 42 } })).toBe(DEFAULT_SLIDES_SCOPE);
    expect(resolveOAuthScope(null)).toBe(DEFAULT_SLIDES_SCOPE);
  });
});

describe('loadOAuthScopeFromFile', () => {
  it('config.json present -> its oauth.scope', () => {
    const dir = stage({ 'config.json': { oauth: { scope: 'https://scope/present' } } });
    try {
      expect(loadOAuthScopeFromFile(path.join(dir, 'config.json'))).toBe('https://scope/present');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('file absent -> default', () => {
    const dir = stage({});
    try {
      expect(loadOAuthScopeFromFile(path.join(dir, 'config.json'))).toBe(DEFAULT_SLIDES_SCOPE);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('unparseable file -> default', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'slides-scope-'));
    writeFileSync(path.join(dir, 'config.json'), '{ not json');
    try {
      expect(loadOAuthScopeFromFile(path.join(dir, 'config.json'))).toBe(DEFAULT_SLIDES_SCOPE);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

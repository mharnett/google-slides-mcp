// ============================================
// Runtime onboarding path (src/authCli.ts) — pure/offline surface.
// ============================================
// Importing this module must NOT start the live OAuth flow (the flow is guarded
// behind an invoked-directly check). If import triggered the flow, this test
// file would hang / open a browser. Reaching the assertions at all proves the
// module is import-safe.

import { describe, it, expect } from 'vitest';
import { requireClientCreds, buildAuthUrl, buildTokenExchangeParams, loadScope } from './authCli.js';
import { DEFAULT_SLIDES_SCOPE } from './oauthScope.js';

describe('authCli.requireClientCreds', () => {
  it('throws listing only the missing var (SECRET), and both in remediation', () => {
    let err: Error | undefined;
    try {
      requireClientCreds({ GOOGLE_CLIENT_ID: 'x' } as NodeJS.ProcessEnv);
    } catch (e) {
      err = e as Error;
    }
    expect(err).toBeDefined();
    const list = err!.message.split('\n')[0];
    expect(list).toMatch(/GOOGLE_CLIENT_SECRET/);
    expect(list).not.toMatch(/GOOGLE_CLIENT_ID/);
  });

  it('returns trimmed creds when both present', () => {
    expect(
      requireClientCreds({
        GOOGLE_CLIENT_ID: ' a ',
        GOOGLE_CLIENT_SECRET: ' b ',
      } as NodeJS.ProcessEnv)
    ).toEqual({ clientId: 'a', clientSecret: 'b' });
  });
});

describe('authCli.buildAuthUrl (runtime path)', () => {
  const url = buildAuthUrl({
    clientId: 'CID',
    redirectUri: 'http://localhost:8123/callback',
    scope: DEFAULT_SLIDES_SCOPE,
    state: 'S',
    codeChallenge: 'CH',
  });
  const p = new URL(url);

  it('carries S256 PKCE + canonical loopback redirect + config scope', () => {
    expect(url.startsWith('https://accounts.google.com/o/oauth2/v2/auth?')).toBe(true);
    expect(p.searchParams.get('code_challenge')).toBe('CH');
    expect(p.searchParams.get('code_challenge_method')).toBe('S256');
    expect(p.searchParams.get('redirect_uri')).toBe('http://localhost:8123/callback');
    expect(p.searchParams.get('scope')).toBe(DEFAULT_SLIDES_SCOPE);
    expect(p.searchParams.get('access_type')).toBe('offline');
    expect(p.searchParams.get('prompt')).toBe('consent');
  });
});

describe('authCli.buildTokenExchangeParams (runtime path)', () => {
  it('sends the PKCE code_verifier on exchange', () => {
    const body = buildTokenExchangeParams({
      code: 'C',
      clientId: 'CID',
      clientSecret: 'SEC',
      redirectUri: 'http://localhost:8123/callback',
      codeVerifier: 'V',
    });
    const p = new URLSearchParams(body);
    expect(p.get('grant_type')).toBe('authorization_code');
    expect(p.get('code_verifier')).toBe('V');
  });
});

describe('authCli.loadScope', () => {
  it('falls back to the min-scope default when repo config.json is absent', () => {
    // No config.json is committed (gitignored), so a fresh checkout resolves to
    // the default. This is the same DEFAULT the helper and runtime share.
    expect(loadScope()).toBe(DEFAULT_SLIDES_SCOPE);
  });
});

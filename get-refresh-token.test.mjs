// ============================================
// Standalone helper (get-refresh-token.cjs) — PURE unit tests.
// ============================================
// Exercises the importable pure functions WITHOUT running the live OAuth flow
// (the flow is guarded behind require.main === module).

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const helper = require('./get-refresh-token.cjs');

describe('helper PKCE (RFC 7636)', () => {
  it('code_challenge matches the RFC 7636 Appendix B vector (S256)', () => {
    expect(helper.computeCodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
    );
  });

  it('generated verifier satisfies the RFC length/charset invariant', () => {
    for (let i = 0; i < 20; i++) {
      const v = helper.generateCodeVerifier();
      expect(v.length).toBeGreaterThanOrEqual(43);
      expect(v.length).toBeLessThanOrEqual(128);
      expect(v).toMatch(/^[A-Za-z0-9\-._~]+$/);
    }
  });
});

describe('helper env validation', () => {
  it('throws naming BOTH missing vars when neither is set', () => {
    expect(() => helper.requireClientCreds({})).toThrow(/GOOGLE_CLIENT_ID/);
    expect(() => helper.requireClientCreds({})).toThrow(/GOOGLE_CLIENT_SECRET/);
  });

  it('lists only the missing var (CLIENT_ID present)', () => {
    let err;
    try {
      helper.requireClientCreds({ GOOGLE_CLIENT_ID: 'x' });
    } catch (e) {
      err = e;
    }
    // The "Missing required env var(s): ..." list names only SECRET, not ID.
    // (The remediation sentence afterwards legitimately names both.)
    const list = err.message.split('\n')[0];
    expect(list).toMatch(/GOOGLE_CLIENT_SECRET/);
    expect(list).not.toMatch(/GOOGLE_CLIENT_ID/);
  });

  it('returns trimmed creds when both present', () => {
    expect(helper.requireClientCreds({ GOOGLE_CLIENT_ID: ' a ', GOOGLE_CLIENT_SECRET: ' b ' })).toEqual(
      { clientId: 'a', clientSecret: 'b' }
    );
  });
});

describe('helper buildAuthUrl (pure)', () => {
  const url = helper.buildAuthUrl({
    clientId: 'CID',
    redirectUri: 'http://localhost:8123/callback',
    scope: 'https://www.googleapis.com/auth/presentations',
    state: 'STATE123',
    codeChallenge: 'CHALLENGE',
  });
  const parsed = new URL(url);

  it('targets the Google auth endpoint', () => {
    expect(url.startsWith('https://accounts.google.com/o/oauth2/v2/auth?')).toBe(true);
  });
  it('carries S256 PKCE challenge', () => {
    expect(parsed.searchParams.get('code_challenge')).toBe('CHALLENGE');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
  });
  it('carries the canonical loopback redirect', () => {
    expect(parsed.searchParams.get('redirect_uri')).toBe('http://localhost:8123/callback');
  });
  it('carries the config scope and offline/consent params', () => {
    expect(parsed.searchParams.get('scope')).toBe(
      'https://www.googleapis.com/auth/presentations'
    );
    expect(parsed.searchParams.get('access_type')).toBe('offline');
    expect(parsed.searchParams.get('prompt')).toBe('consent');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('state')).toBe('STATE123');
  });
});

describe('helper buildTokenExchangeParams (pure)', () => {
  it('includes the PKCE code_verifier on exchange', () => {
    const body = helper.buildTokenExchangeParams({
      code: 'C',
      clientId: 'CID',
      clientSecret: 'SEC',
      redirectUri: 'http://localhost:8123/callback',
      codeVerifier: 'VERIFIER',
    });
    const p = new URLSearchParams(body);
    expect(p.get('grant_type')).toBe('authorization_code');
    expect(p.get('code_verifier')).toBe('VERIFIER');
    expect(p.get('code')).toBe('C');
    expect(p.get('redirect_uri')).toBe('http://localhost:8123/callback');
  });
});

describe('helper default scope is min-scope', () => {
  it('DEFAULT_SLIDES_SCOPE is presentations only', () => {
    expect(helper.DEFAULT_SLIDES_SCOPE).toBe('https://www.googleapis.com/auth/presentations');
    expect(helper.DEFAULT_SLIDES_SCOPE).not.toContain('drive');
  });
});

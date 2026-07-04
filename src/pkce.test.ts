// ============================================
// Runtime PKCE (RFC 7636) + canonical loopback redirect form.
// ============================================
// The runtime onboarding path (src/authCli.ts) must use the SAME S256 PKCE as
// the standalone get-refresh-token.cjs helper and the SAME loopback redirect
// form. This test locks the RFC 7636 vector and the verifier invariant.

import { describe, it, expect } from 'vitest';
import {
  base64url,
  generateCodeVerifier,
  computeCodeChallenge,
  buildLoopbackRedirectUri,
  LOOPBACK_HOST,
  LOOPBACK_PATH,
} from './pkce.js';

describe('runtime PKCE (RFC 7636)', () => {
  it('code_verifier is 43-128 chars of the unreserved set', () => {
    for (let i = 0; i < 30; i++) {
      const v = generateCodeVerifier();
      expect(v.length).toBeGreaterThanOrEqual(43);
      expect(v.length).toBeLessThanOrEqual(128);
      expect(v).toMatch(/^[A-Za-z0-9\-._~]+$/);
    }
  });

  it('code_challenge matches the RFC 7636 Appendix B vector (S256)', () => {
    expect(computeCodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
    );
  });

  it('code_challenge is url-safe with no padding', () => {
    const c = computeCodeChallenge(generateCodeVerifier());
    expect(c).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(c).not.toContain('=');
  });

  it('base64url is url-safe with no padding for bytes needing all substitutions', () => {
    // 0xfb 0xef 0xbe -> would contain + and / and = in standard base64
    expect(base64url(Buffer.from([0xfb, 0xef, 0xbe, 0x00, 0x01, 0x02, 0x03, 0xff]))).not.toMatch(
      /[+/=]/
    );
  });
});

describe('canonical loopback redirect form (shared with the helper)', () => {
  it('uses host `localhost` and path `/callback`', () => {
    expect(LOOPBACK_HOST).toBe('localhost');
    expect(LOOPBACK_PATH).toBe('/callback');
  });

  it('builds http://localhost:<port>/callback', () => {
    expect(buildLoopbackRedirectUri(8123)).toBe('http://localhost:8123/callback');
    expect(buildLoopbackRedirectUri(8090)).toBe('http://localhost:8090/callback');
  });
});

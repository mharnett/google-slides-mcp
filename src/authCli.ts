#!/usr/bin/env node
// ============================================
// Runtime onboarding path: `npm run get-token`.
// ============================================
// Mints a GOOGLE_REFRESH_TOKEN using PKCE (RFC 7636, S256) on Google's
// installed-app loopback flow. Shares the PKCE crypto + canonical loopback
// redirect form (src/pkce.ts) and the OAuth scope resolver (src/oauthScope.ts)
// with the standalone get-refresh-token.cjs helper, so the two onboarding paths
// never drift on what they ask Google to grant or how they prove PKCE.
//
// A user brings THEIR OWN Google OAuth client (Desktop app): export
// GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then run this. Nothing is read from
// a home-directory keyfile or a shared OAuth client.

import http from 'http';
import { randomBytes } from 'crypto';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import open from 'open';
import { generateCodeVerifier, computeCodeChallenge, buildLoopbackRedirectUri } from './pkce.js';
import { loadOAuthScopeFromFile } from './oauthScope.js';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

interface ClientCreds {
  clientId: string;
  clientSecret: string;
}

/** Require both client creds from an env-like object; throw a clear error otherwise. */
export const requireClientCreds = (env: NodeJS.ProcessEnv): ClientCreds => {
  const clientId = (env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (env.GOOGLE_CLIENT_SECRET || '').trim();
  const missing: string[] = [];
  if (!clientId) missing.push('GOOGLE_CLIENT_ID');
  if (!clientSecret) missing.push('GOOGLE_CLIENT_SECRET');
  if (missing.length) {
    throw new Error(
      `Missing required env var(s): ${missing.join(', ')}.\n` +
        `Create a "Desktop app" OAuth client at https://console.cloud.google.com/apis/credentials, ` +
        `then export GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.`
    );
  }
  return { clientId, clientSecret };
};

/** Resolve the OAuth scope for THIS install (this repo's config.json). */
export const loadScope = (): string => {
  // build/authCli.js sits alongside the repo's config.json in a real install; in
  // dev the resolver simply falls back to the default when config.json is absent.
  const here = dirname(fileURLToPath(import.meta.url));
  // config.json lives at the repo root, one level up from build/.
  return loadOAuthScopeFromFile(join(here, '..', 'config.json'));
};

export const buildAuthUrl = (args: {
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
}): string => {
  const params = new URLSearchParams({
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    response_type: 'code',
    scope: args.scope,
    access_type: 'offline', // REQUIRED for Google to return a refresh_token
    prompt: 'consent', // force a refresh_token even on re-consent
    state: args.state,
    code_challenge: args.codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${AUTH_URL}?${params.toString()}`;
};

export const buildTokenExchangeParams = (args: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  codeVerifier: string;
}): string =>
  new URLSearchParams({
    grant_type: 'authorization_code',
    code: args.code,
    client_id: args.clientId,
    client_secret: args.clientSecret,
    redirect_uri: args.redirectUri,
    code_verifier: args.codeVerifier, // PKCE proof — sent on exchange
  }).toString();

const run = async (): Promise<void> => {
  const { clientId, clientSecret } = requireClientCreds(process.env);
  const scope = loadScope();
  const port = Number(process.env.OAUTH_CALLBACK_PORT || 8123);
  const redirectUri = buildLoopbackRedirectUri(port);

  const state = randomBytes(16).toString('hex');
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = computeCodeChallenge(codeVerifier);
  const authUrl = buildAuthUrl({ clientId, redirectUri, scope, state, codeChallenge });

  const code = await new Promise<string>((resolve, reject) => {
    let settled = false;
    const done = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      fn();
    };
    const server = http.createServer((req, res) => {
      if (!req.url || !req.url.startsWith('/callback')) {
        res.writeHead(404).end();
        return;
      }
      const u = new URL(req.url, redirectUri);
      const err = u.searchParams.get('error');
      const returnedCode = u.searchParams.get('code');
      const returnedState = u.searchParams.get('state');
      if (err) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Authorization denied</h1><p>You can close this tab.</p>');
        done(() => {
          server.close();
          reject(new Error(`OAuth denied: ${err}`));
        });
        return;
      }
      if (returnedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>State mismatch</h1><p>Possible CSRF. Re-run the command.</p>');
        done(() => {
          server.close();
          reject(new Error('OAuth state mismatch -- possible CSRF'));
        });
        return;
      }
      if (!returnedCode) {
        res.writeHead(204).end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Signed in</h1><p>You can close this tab and return to the terminal.</p>');
      done(() => {
        setTimeout(() => server.close(), 200);
        resolve(returnedCode);
      });
    });
    server.on('error', (e: Error) => done(() => reject(new Error(`Loopback server failed: ${e.message}`))));
    server.listen(port, '127.0.0.1', () => {
      process.stderr.write(`\nCallback server listening on ${redirectUri}\n`);
      process.stderr.write('Opening your browser to sign in with Google...\n');
      process.stderr.write(`If it doesn't open, visit:\n  ${authUrl}\n\n`);
      void open(authUrl, { wait: false }).catch(() => {
        process.stderr.write('Could not open a browser automatically; paste the URL above.\n');
      });
    });
    setTimeout(
      () =>
        done(() => {
          server.close();
          reject(new Error('Timed out waiting for OAuth callback (5 minutes).'));
        }),
      5 * 60 * 1000
    );
  });

  process.stderr.write('Authorization code received. Exchanging for tokens...\n');
  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: buildTokenExchangeParams({ code, clientId, clientSecret, redirectUri, codeVerifier }),
  });
  const data = (await resp.json()) as { refresh_token?: string };

  if (!data.refresh_token) {
    process.stderr.write(
      'No refresh_token returned. If you previously granted consent, revoke it at ' +
        'https://myaccount.google.com/permissions and re-run.\n'
    );
    // Do not print the raw token response (may contain an access_token).
    process.exit(1);
  }

  // The refresh token is the intended output. STDOUT only; nothing else
  // sensitive is printed. Do NOT redirect stdout to a shared log.
  process.stdout.write(`GOOGLE_REFRESH_TOKEN=${data.refresh_token}\n`);
  process.stderr.write('\nDone. Set the line above in your environment.\n');
  process.exit(0);
};

// Only run the live flow when executed directly (not when imported by tests).
const invokedDirectly = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  run().catch((err: Error) => {
    process.stderr.write(`\nError: ${err.message}\n`);
    process.exit(1);
  });
}

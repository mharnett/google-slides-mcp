// ============================================
// TYPED ERRORS (mirrors mcp-google-ads pattern)
// ============================================

export class GoogleSlidesAuthError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "GoogleSlidesAuthError";
  }
}

export class GoogleSlidesRateLimitError extends Error {
  constructor(
    public readonly retryAfterMs: number,
    cause?: unknown,
  ) {
    super(`Rate limited, retry after ${retryAfterMs}ms`);
    this.name = "GoogleSlidesRateLimitError";
    this.cause = cause;
  }
}

export class GoogleSlidesServiceError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "GoogleSlidesServiceError";
  }
}

// ============================================
// STARTUP CREDENTIAL VALIDATION
// ============================================

export function validateCredentials(): { valid: boolean; missing: string[] } {
  const required = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REFRESH_TOKEN",
  ];
  const missing = required.filter(
    (key) => !process.env[key] || process.env[key]!.trim() === "",
  );
  return { valid: missing.length === 0, missing };
}

// ============================================
// ERROR CLASSIFIER
// ============================================

export function classifyError(error: any): Error {
  const message = error?.message || String(error);
  const status =
    error?.code || error?.status || error?.response?.status;

  // Auth failures: expired tokens, invalid credentials, permission denied
  if (
    status === 401 ||
    status === 403 ||
    message.includes("UNAUTHENTICATED") ||
    message.includes("PERMISSION_DENIED") ||
    message.includes("invalid_grant") ||
    message.includes("Token has been expired") ||
    message.includes("refresh token") ||
    message.includes("Invalid Credentials")
  ) {
    return new GoogleSlidesAuthError(
      `Auth failed: ${message}. Check GOOGLE_REFRESH_TOKEN.`,
      error,
    );
  }

  // Rate limiting
  if (
    status === 429 ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("Rate Limit Exceeded") ||
    message.includes("rateLimitExceeded")
  ) {
    const retryMs = error?.retryAfter ? error.retryAfter * 1000 : 60_000;
    return new GoogleSlidesRateLimitError(retryMs, error);
  }

  // Server errors
  if (
    (typeof status === "number" && status >= 500) ||
    message.includes("INTERNAL") ||
    message.includes("UNAVAILABLE") ||
    message.includes("Backend Error")
  ) {
    return new GoogleSlidesServiceError(
      `Google Slides API server error: ${message}`,
      error,
    );
  }

  // Unrecognized — return as-is
  return error;
}

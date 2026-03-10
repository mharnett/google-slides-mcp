import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  GoogleSlidesAuthError,
  GoogleSlidesRateLimitError,
  GoogleSlidesServiceError,
  validateCredentials,
  classifyError,
} from "./errors.js";

// ============================================
// Error class tests
// ============================================

describe("GoogleSlidesAuthError", () => {
  it("sets name and message", () => {
    const err = new GoogleSlidesAuthError("bad token");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("GoogleSlidesAuthError");
    expect(err.message).toBe("bad token");
  });

  it("stores cause", () => {
    const cause = new Error("original");
    const err = new GoogleSlidesAuthError("wrapper", cause);
    expect(err.cause).toBe(cause);
  });

  it("works without cause", () => {
    const err = new GoogleSlidesAuthError("no cause");
    expect(err.cause).toBeUndefined();
  });
});

describe("GoogleSlidesRateLimitError", () => {
  it("sets retryAfterMs and message", () => {
    const err = new GoogleSlidesRateLimitError(5000);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("GoogleSlidesRateLimitError");
    expect(err.retryAfterMs).toBe(5000);
    expect(err.message).toBe("Rate limited, retry after 5000ms");
  });

  it("stores cause", () => {
    const cause = { detail: "quota exceeded" };
    const err = new GoogleSlidesRateLimitError(10000, cause);
    expect(err.cause).toBe(cause);
  });
});

describe("GoogleSlidesServiceError", () => {
  it("sets name and message", () => {
    const err = new GoogleSlidesServiceError("server down");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("GoogleSlidesServiceError");
    expect(err.message).toBe("server down");
  });

  it("stores cause", () => {
    const cause = new Error("503");
    const err = new GoogleSlidesServiceError("unavailable", cause);
    expect(err.cause).toBe(cause);
  });
});

// ============================================
// validateCredentials tests
// ============================================

describe("validateCredentials", () => {
  const envKeys = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REFRESH_TOKEN",
  ] as const;

  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const key of envKeys) {
      saved[key] = process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  });

  it("returns valid when all env vars are set", () => {
    for (const key of envKeys) {
      process.env[key] = "test-value";
    }
    const result = validateCredentials();
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("returns missing keys when env vars are absent", () => {
    for (const key of envKeys) {
      delete process.env[key];
    }
    const result = validateCredentials();
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual([...envKeys]);
  });

  it("treats empty-string values as missing", () => {
    for (const key of envKeys) {
      process.env[key] = "   ";
    }
    const result = validateCredentials();
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual([...envKeys]);
  });

  it("detects a single missing key", () => {
    process.env.GOOGLE_CLIENT_ID = "id";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    delete process.env.GOOGLE_REFRESH_TOKEN;
    const result = validateCredentials();
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(["GOOGLE_REFRESH_TOKEN"]);
  });
});

// ============================================
// classifyError tests
// ============================================

describe("classifyError", () => {
  // --- Auth errors ---
  it("classifies status 401 as auth error", () => {
    const err = classifyError({ message: "Unauthorized", status: 401 });
    expect(err).toBeInstanceOf(GoogleSlidesAuthError);
  });

  it("classifies status 403 as auth error", () => {
    const err = classifyError({ message: "Forbidden", code: 403 });
    expect(err).toBeInstanceOf(GoogleSlidesAuthError);
  });

  it("classifies response.status 401 as auth error", () => {
    const err = classifyError({
      message: "fail",
      response: { status: 401 },
    });
    expect(err).toBeInstanceOf(GoogleSlidesAuthError);
  });

  it("classifies UNAUTHENTICATED message as auth error", () => {
    const err = classifyError({ message: "UNAUTHENTICATED: expired" });
    expect(err).toBeInstanceOf(GoogleSlidesAuthError);
  });

  it("classifies PERMISSION_DENIED message as auth error", () => {
    const err = classifyError({ message: "PERMISSION_DENIED" });
    expect(err).toBeInstanceOf(GoogleSlidesAuthError);
  });

  it("classifies invalid_grant message as auth error", () => {
    const err = classifyError({ message: "invalid_grant" });
    expect(err).toBeInstanceOf(GoogleSlidesAuthError);
  });

  it("classifies 'Token has been expired' as auth error", () => {
    const err = classifyError({ message: "Token has been expired or revoked" });
    expect(err).toBeInstanceOf(GoogleSlidesAuthError);
  });

  it("classifies 'Invalid Credentials' as auth error", () => {
    const err = classifyError({ message: "Invalid Credentials" });
    expect(err).toBeInstanceOf(GoogleSlidesAuthError);
  });

  // --- Rate-limit errors ---
  it("classifies status 429 as rate-limit error", () => {
    const err = classifyError({ message: "Too many requests", status: 429 });
    expect(err).toBeInstanceOf(GoogleSlidesRateLimitError);
    expect((err as GoogleSlidesRateLimitError).retryAfterMs).toBe(60_000);
  });

  it("classifies RESOURCE_EXHAUSTED as rate-limit error", () => {
    const err = classifyError({ message: "RESOURCE_EXHAUSTED" });
    expect(err).toBeInstanceOf(GoogleSlidesRateLimitError);
  });

  it("classifies rateLimitExceeded as rate-limit error", () => {
    const err = classifyError({ message: "rateLimitExceeded" });
    expect(err).toBeInstanceOf(GoogleSlidesRateLimitError);
  });

  it("uses retryAfter from error when available", () => {
    const err = classifyError({
      message: "Rate Limit Exceeded",
      retryAfter: 30,
    });
    expect(err).toBeInstanceOf(GoogleSlidesRateLimitError);
    expect((err as GoogleSlidesRateLimitError).retryAfterMs).toBe(30_000);
  });

  // --- Service errors ---
  it("classifies status 500 as service error", () => {
    const err = classifyError({ message: "Internal Server Error", status: 500 });
    expect(err).toBeInstanceOf(GoogleSlidesServiceError);
  });

  it("classifies status 503 as service error", () => {
    const err = classifyError({ message: "Service Unavailable", status: 503 });
    expect(err).toBeInstanceOf(GoogleSlidesServiceError);
  });

  it("classifies INTERNAL message as service error", () => {
    const err = classifyError({ message: "INTERNAL error occurred" });
    expect(err).toBeInstanceOf(GoogleSlidesServiceError);
  });

  it("classifies UNAVAILABLE message as service error", () => {
    const err = classifyError({ message: "UNAVAILABLE" });
    expect(err).toBeInstanceOf(GoogleSlidesServiceError);
  });

  it("classifies 'Backend Error' as service error", () => {
    const err = classifyError({ message: "Backend Error" });
    expect(err).toBeInstanceOf(GoogleSlidesServiceError);
  });

  // --- Unrecognized errors ---
  it("returns original error for unrecognized errors", () => {
    const original = new Error("something else");
    const result = classifyError(original);
    expect(result).toBe(original);
  });

  it("handles null/undefined gracefully", () => {
    const result = classifyError(null);
    expect(result).toBeNull();
  });

  it("handles string errors", () => {
    const result = classifyError("some string error");
    // Should not crash; string doesn't match any pattern
    expect(result).toBe("some string error");
  });
});

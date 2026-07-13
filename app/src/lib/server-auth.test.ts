import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { NextRequest } from "next/server";
import { SignJWT } from "jose";

import { AuthConfigurationError } from "./auth-config";
import { AuthError, authErrorResponse, generateToken, requireUser } from "./server-auth";

const originalEnv = { ...process.env };
const validEnv = {
  AUTH_EMAIL: "owner@company.com",
  AUTH_PASSWORD: "correct-horse-battery-staple",
  AUTH_SECRET: "0123456789abcdef0123456789abcdef",
};

function configureAuth() {
  Object.assign(process.env, validEnv);
}

function requestWithToken(token?: string) {
  return new NextRequest("http://localhost/api/signals", {
    headers: token === undefined ? {} : { authorization: `Bearer ${token}` },
  });
}

async function sign(payload: Record<string, unknown>, secret = validEnv.AUTH_SECRET, expires = "7d") {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expires)
    .sign(new TextEncoder().encode(secret));
}

async function expectAuthError(promise: Promise<unknown>, message: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof AuthError);
    assert.equal(error.status, 401);
    assert.equal(error.message, message);
    return true;
  });
}

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
});

test("generateToken and requireUser complete a valid round trip", async () => {
  configureAuth();
  const token = await generateToken(validEnv.AUTH_EMAIL);
  assert.deepEqual(await requireUser(requestWithToken(token)), { email: validEnv.AUTH_EMAIL });
});

test("requireUser rejects missing and malformed bearer tokens", async () => {
  configureAuth();
  await expectAuthError(requireUser(requestWithToken()), "Missing or invalid authorization header");
  await expectAuthError(requireUser(requestWithToken("not-a-jwt")), "Invalid or expired token");
});

test("requireUser rejects tokens signed with the wrong or rotated secret", async () => {
  configureAuth();
  const wrongSecretToken = await sign({ email: validEnv.AUTH_EMAIL }, "abcdef0123456789abcdef0123456789");
  await expectAuthError(requireUser(requestWithToken(wrongSecretToken)), "Invalid or expired token");

  const token = await generateToken(validEnv.AUTH_EMAIL);
  process.env.AUTH_SECRET = "fedcba9876543210fedcba9876543210";
  await expectAuthError(requireUser(requestWithToken(token)), "Invalid or expired token");
});

test("requireUser rejects expired tokens and invalid payloads", async () => {
  configureAuth();
  const expired = await sign({ email: validEnv.AUTH_EMAIL }, validEnv.AUTH_SECRET, "1 second ago");
  await expectAuthError(requireUser(requestWithToken(expired)), "Invalid or expired token");

  for (const payload of [{}, { email: 42 }, { email: "" }]) {
    await expectAuthError(
      requireUser(requestWithToken(await sign(payload))),
      "Invalid token payload",
    );
  }
});

test("authentication fails closed when server configuration is missing", async () => {
  delete process.env.AUTH_EMAIL;
  delete process.env.AUTH_PASSWORD;
  delete process.env.AUTH_SECRET;

  await assert.rejects(generateToken(validEnv.AUTH_EMAIL), AuthConfigurationError);
  await assert.rejects(requireUser(requestWithToken("unused")), AuthConfigurationError);
});

test("authErrorResponse preserves generic 503 configuration errors", async () => {
  const response = authErrorResponse(new AuthConfigurationError(["AUTH_SECRET"]));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Server authentication is not configured" });
});

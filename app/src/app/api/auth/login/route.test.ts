import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { NextRequest } from "next/server";

import { POST } from "./route";

const originalEnv = { ...process.env };

function loginRequest(email: string, password: string) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

function restoreEnvironment() {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
}

afterEach(restoreEnvironment);

test("returns 503 for repository defaults even in development", async () => {
  process.env.NODE_ENV = "development";
  process.env.AUTH_EMAIL = "admin@example.com";
  process.env.AUTH_PASSWORD = "changeme";
  process.env.AUTH_SECRET = "mir-local-dev-secret";

  const response = await POST(loginRequest("admin@example.com", "changeme"));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Server authentication is not configured" });
});

test("returns a JWT for valid submitted credentials", async () => {
  process.env.AUTH_EMAIL = "owner@company.com";
  process.env.AUTH_PASSWORD = "correct-horse-battery-staple";
  process.env.AUTH_SECRET = "0123456789abcdef0123456789abcdef";

  const response = await POST(loginRequest("owner@company.com", "correct-horse-battery-staple"));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.email, "owner@company.com");
  assert.equal(typeof body.token, "string");
  assert.ok(body.token.length > 0);
});

test("returns 401 for an invalid submitted password", async () => {
  process.env.AUTH_EMAIL = "owner@company.com";
  process.env.AUTH_PASSWORD = "correct-horse-battery-staple";
  process.env.AUTH_SECRET = "0123456789abcdef0123456789abcdef";

  const response = await POST(loginRequest("owner@company.com", "invalid-password"));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Invalid credentials" });
});

import assert from "node:assert/strict";
import test from "node:test";

import { AuthConfigurationError, getAuthConfig } from "./auth-config";

const VALID_ENV = {
  AUTH_EMAIL: "owner@company.com",
  AUTH_PASSWORD: "correct-horse-battery-staple",
  AUTH_SECRET: "0123456789abcdef0123456789abcdef",
};

function expectConfigurationError(env: Readonly<Record<string, string | undefined>>, fields: string[]) {
  assert.throws(
    () => getAuthConfig(env),
    (error: unknown) => {
      assert.ok(error instanceof AuthConfigurationError);
      assert.equal(error.status, 503);
      assert.deepEqual(error.fields, fields);
      assert.equal(error.message, "Server authentication is not configured");
      return true;
    },
  );
}

test("accepts explicit strong authentication config", () => {
  assert.deepEqual(getAuthConfig(VALID_ENV), {
    email: VALID_ENV.AUTH_EMAIL,
    password: VALID_ENV.AUTH_PASSWORD,
    secret: VALID_ENV.AUTH_SECRET,
  });
});

test("normalizes authentication email case", () => {
  assert.deepEqual(getAuthConfig({ ...VALID_ENV, AUTH_EMAIL: "Owner@Company.COM" }), {
    email: VALID_ENV.AUTH_EMAIL,
    password: VALID_ENV.AUTH_PASSWORD,
    secret: VALID_ENV.AUTH_SECRET,
  });
});

test("rejects missing authentication fields even in development", () => {
  expectConfigurationError({ NODE_ENV: "development" }, [
    "AUTH_EMAIL",
    "AUTH_PASSWORD",
    "AUTH_SECRET",
  ]);
});

test("rejects blocked authentication email and passwords", () => {
  expectConfigurationError({ ...VALID_ENV, AUTH_EMAIL: "admin@example.com" }, ["AUTH_EMAIL"]);
  expectConfigurationError({ ...VALID_ENV, AUTH_PASSWORD: "changeme" }, ["AUTH_PASSWORD"]);
  expectConfigurationError({ ...VALID_ENV, AUTH_PASSWORD: "password" }, ["AUTH_PASSWORD"]);
  expectConfigurationError({ ...VALID_ENV, AUTH_PASSWORD: "password123" }, ["AUTH_PASSWORD"]);
  expectConfigurationError({ ...VALID_ENV, AUTH_PASSWORD: "short-pass" }, ["AUTH_PASSWORD"]);
});

test("rejects leading or trailing whitespace in every authentication field", () => {
  expectConfigurationError({ ...VALID_ENV, AUTH_EMAIL: ` ${VALID_ENV.AUTH_EMAIL}` }, ["AUTH_EMAIL"]);
  expectConfigurationError({ ...VALID_ENV, AUTH_EMAIL: `${VALID_ENV.AUTH_EMAIL} ` }, ["AUTH_EMAIL"]);
  expectConfigurationError({ ...VALID_ENV, AUTH_PASSWORD: ` ${VALID_ENV.AUTH_PASSWORD}` }, ["AUTH_PASSWORD"]);
  expectConfigurationError({ ...VALID_ENV, AUTH_PASSWORD: `${VALID_ENV.AUTH_PASSWORD} ` }, ["AUTH_PASSWORD"]);
  expectConfigurationError({ ...VALID_ENV, AUTH_SECRET: ` ${VALID_ENV.AUTH_SECRET}` }, ["AUTH_SECRET"]);
  expectConfigurationError({ ...VALID_ENV, AUTH_SECRET: `${VALID_ENV.AUTH_SECRET} ` }, ["AUTH_SECRET"]);
  expectConfigurationError({ ...VALID_ENV, AUTH_PASSWORD: "changeme    " }, ["AUTH_PASSWORD"]);
  expectConfigurationError({ ...VALID_ENV, AUTH_SECRET: "mir-default-secret-change-me    " }, ["AUTH_SECRET"]);
});

test("rejects blocked, short, and repeated authentication secrets", () => {
  for (const secret of [
    "mir-default-secret-change-me",
    "mir-local-dev-secret",
    "mir-docker-secret",
    "change-this-to-a-random-string",
    "too-short-secret",
    "a".repeat(32),
  ]) {
    expectConfigurationError({ ...VALID_ENV, AUTH_SECRET: secret }, ["AUTH_SECRET"]);
  }
});

test("rejects known authentication values case-insensitively", () => {
  expectConfigurationError({ ...VALID_ENV, AUTH_EMAIL: "ADMIN@EXAMPLE.COM" }, ["AUTH_EMAIL"]);
  expectConfigurationError({ ...VALID_ENV, AUTH_PASSWORD: "PASSWORD123" }, ["AUTH_PASSWORD"]);
  expectConfigurationError({ ...VALID_ENV, AUTH_SECRET: "MIR-LOCAL-DEV-SECRET" }, ["AUTH_SECRET"]);
  expectConfigurationError(
    { ...VALID_ENV, AUTH_SECRET: "REPLACE-WITH-A-STRONG-RANDOM-SECRET" },
    ["AUTH_SECRET"],
  );
});

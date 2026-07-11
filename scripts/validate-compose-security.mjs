import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const temp = mkdtempSync(join(tmpdir(), "mir-compose-security-"));
const safeEnvFile = join(temp, "safe.env");
const required = ["AUTH_EMAIL", "AUTH_PASSWORD", "AUTH_SECRET", "POSTGRES_PASSWORD"];
const safeValues = {
  AUTH_EMAIL: "owner@company.com",
  AUTH_PASSWORD: "correct-horse-battery-staple",
  AUTH_SECRET: "0123456789abcdef0123456789abcdef",
  POSTGRES_PASSWORD: "abcdef0123456789abcdef0123456789abcdef0123456789",
};
const cleanEnv = { ...process.env };
for (const name of required) delete cleanEnv[name];

function writeEnvFile(path, values) {
  const lines = [
    ...Object.entries(values).map(([name, value]) => `${name}=${value}`),
    "LLM_API_KEY=test-key",
  ];
  writeFileSync(
    path,
    lines.join("\n") + "\n",
  );
}

writeEnvFile(safeEnvFile, safeValues);

function composeConfig(envFile) {
  return spawnSync(
    "docker",
    ["compose", "--env-file", envFile, "config", "--format", "json"],
    { cwd: root, env: cleanEnv, encoding: "utf8" },
  );
}

try {
  for (const omitted of required) {
    const envFile = join(temp, `missing-${omitted}.env`);
    const values = Object.fromEntries(
      Object.entries(safeValues).filter(([name]) => name !== omitted),
    );
    writeEnvFile(envFile, values);

    const negative = composeConfig(envFile);
    assert.notEqual(negative.status, 0, `Compose must reject missing ${omitted}`);
    assert.match(
      negative.stderr,
      new RegExp(`required variable ${omitted} is missing a value`),
      `Compose error must identify missing ${omitted}`,
    );
  }

  const positive = composeConfig(safeEnvFile);
  assert.equal(positive.status, 0, positive.stderr);
  const config = JSON.parse(positive.stdout);
  assert.equal(config.services.app.environment.NODE_ENV, undefined);
  assert.equal(config.services.app.ports[0].host_ip, "127.0.0.1");
  assert.equal(config.services.db.ports, undefined);
  assert.equal(config.services.app.environment.AUTH_EMAIL, safeValues.AUTH_EMAIL);
  assert.equal(config.services.app.environment.AUTH_PASSWORD, safeValues.AUTH_PASSWORD);
  assert.equal(config.services.app.environment.AUTH_SECRET, safeValues.AUTH_SECRET);
  assert.equal(config.services.db.environment.POSTGRES_PASSWORD, safeValues.POSTGRES_PASSWORD);
  assert.equal(
    config.services.app.environment.DATABASE_URL,
    `postgresql://mir:${safeValues.POSTGRES_PASSWORD}@db:5432/mir`,
  );
  assert.doesNotMatch(config.services.app.environment.DATABASE_URL, /mir:mir@/);
  console.log("Docker Compose security contract OK");
} finally {
  rmSync(temp, { recursive: true, force: true });
}

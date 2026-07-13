import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  AUTH_PASSWORD: "correct$horse#battery%staple?/@2026",
  AUTH_SECRET: "0123456789abcdef0123456789abcdef",
  POSTGRES_PASSWORD: "p@ss$word#%?/-abcdef0123456789",
};
const cleanEnv = { ...process.env };
for (const name of [...required, "MIR_BIND_ADDRESS", "MIR_PORT"]) delete cleanEnv[name];

function writeEnvFile(path, values) {
  const lines = [
    ...Object.entries(values).map(([name, value]) => `${name}='${value.replaceAll("'", "\\'")}'`),
    "LLM_API_KEY='test-key'",
  ];
  writeFileSync(
    path,
    lines.join("\n") + "\n",
  );
}

function composeEnvironment(envFile) {
  return spawnSync(
    "docker",
    ["compose", "--env-file", envFile, "config", "--environment"],
    { cwd: root, env: cleanEnv, encoding: "utf8" },
  );
}

function parseEnvironment(output) {
  return Object.fromEntries(
    output.trim().split("\n").map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
  );
}

function composeLiteral(value) {
  return value.replaceAll("$$", "$");
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

    const emptyEnvFile = join(temp, `empty-${omitted}.env`);
    writeEnvFile(emptyEnvFile, { ...safeValues, [omitted]: "" });
    const empty = composeConfig(emptyEnvFile);
    assert.notEqual(empty.status, 0, `Compose must reject empty ${omitted}`);
    assert.match(
      empty.stderr,
      new RegExp(`required variable ${omitted} is missing a value`),
      `Compose error must identify empty ${omitted}`,
    );
  }

  const positive = composeConfig(safeEnvFile);
  assert.equal(positive.status, 0, positive.stderr);
  const environmentResult = composeEnvironment(safeEnvFile);
  assert.equal(environmentResult.status, 0, environmentResult.stderr);
  const interpolationEnvironment = parseEnvironment(environmentResult.stdout);
  for (const [name, value] of Object.entries(safeValues)) {
    assert.equal(interpolationEnvironment[name], value, `${name} must parse exactly from .env`);
  }

  const config = JSON.parse(positive.stdout);
  assert.equal(config.services.app.environment.NODE_ENV, undefined);
  assert.equal(config.services.app.ports[0].host_ip, "127.0.0.1");
  assert.equal(config.services.db.ports, undefined);
  assert.equal(config.services.app.environment.AUTH_EMAIL, safeValues.AUTH_EMAIL);
  assert.equal(
    composeLiteral(config.services.app.environment.AUTH_PASSWORD),
    safeValues.AUTH_PASSWORD,
  );
  assert.equal(config.services.app.environment.AUTH_SECRET, safeValues.AUTH_SECRET);
  assert.equal(
    composeLiteral(config.services.db.environment.POSTGRES_PASSWORD),
    safeValues.POSTGRES_PASSWORD,
  );
  assert.equal(config.services.app.environment.DATABASE_URL, undefined);
  assert.equal(config.services.app.environment.PGHOST, "db");
  assert.equal(config.services.app.environment.PGPORT, "5432");
  assert.equal(config.services.app.environment.PGDATABASE, "mir");
  assert.equal(config.services.app.environment.PGUSER, "mir");
  assert.equal(
    composeLiteral(config.services.app.environment.PGPASSWORD),
    safeValues.POSTGRES_PASSWORD,
  );

  const dockerfile = readFileSync(join(root, "Dockerfile"), "utf8");
  assert.match(dockerfile, /^FROM python:3\.12-slim-bookworm AS python-deps$/m);
  assert.match(dockerfile, /^FROM node:22-bookworm-slim AS node-builder$/m);
  const runnerStageStart = dockerfile.search(/^FROM\s+\S+\s+AS\s+runner\s*$/im);
  assert.notEqual(runnerStageStart, -1, "Dockerfile must define the production runner stage");
  const runnerStage = dockerfile.slice(runnerStageStart);
  assert.match(runnerStage, /^FROM node:22-bookworm-slim AS runner$/m);
  assert.match(runnerStage, /^ENV NODE_ENV=production$/m);
  assert.match(runnerStage, /^ENV PYTHONPATH=\/app$/m);
  assert.match(runnerStage, /^CMD \["node", "server\.js"\]$/m);
  assert.match(runnerStage, /^COPY --from=python-deps \/usr\/local \/usr\/local$/m);
  assert.doesNotMatch(runnerStage, /apt-get install[^\n]*(?:python3|python3-pip)/);
  assert.match(runnerStage, /^RUN python3 --version \| grep -E '\^Python 3\\\.12\\\.'$/m);
  assert.match(
    runnerStage,
    /^RUN python3 -c "import psycopg2; import mir\.db"$/m,
  );
  const pythonRuntimeCopy = runnerStage.indexOf("COPY --from=python-deps /usr/local /usr/local");
  const pythonVersionSmoke = runnerStage.indexOf("RUN python3 --version");
  const mirSourceCopy = runnerStage.indexOf("COPY mir/ /app/mir/");
  const pythonImportSmoke = runnerStage.indexOf('RUN python3 -c "import psycopg2; import mir.db"');
  assert.ok(
    pythonRuntimeCopy < pythonVersionSmoke &&
      pythonVersionSmoke < mirSourceCopy &&
      mirSourceCopy < pythonImportSmoke,
    "Python 3.12 runtime and MIR source must be copied before the import smoke",
  );

  const dockerignore = readFileSync(join(root, ".dockerignore"), "utf8");
  assert.match(dockerignore, /^\.env$/m);
  assert.match(dockerignore, /^\.env\.\*$/m);
  assert.match(dockerignore, /^app\/\.env$/m);
  assert.match(dockerignore, /^app\/\.env\.\*$/m);
  assert.match(dockerignore, /^app\/node_modules$/m);
  assert.match(dockerignore, /^app\/\.next$/m);
  assert.match(dockerignore, /^\.venv\/$/m);
  console.log("Docker Compose security contract OK");
} finally {
  rmSync(temp, { recursive: true, force: true });
}

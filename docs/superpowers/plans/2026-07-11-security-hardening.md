# Market Intelligence Radar Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close issues #1 and #2 by making the documented self-hosted path fail closed and updating Next.js with an enforceable dependency audit gate.

**Architecture:** Centralize authentication environment validation in a pure TypeScript module used at request time by login, token creation, and token verification. Docker Compose must require explicit credentials, inherit the image's production mode, keep the application on localhost by default, and keep PostgreSQL internal. A standalone Node validator proves the resolved Compose contract. The frontend CI then runs auth tests, Compose validation, production dependency audit, and build.

**Tech Stack:** Next.js 16, TypeScript, Node 22 built-in test runner through `tsx` 4.23.0, Docker Compose, GitHub Actions, Python 3.12 smoke checks.

## Global Constraints

- Authentication validation must be independent of `NODE_ENV`; development mode cannot re-enable repository defaults.
- `AUTH_PASSWORD` must contain at least 12 characters and must not equal a known repository default.
- `AUTH_SECRET` must contain at least 32 characters, must not equal a known repository placeholder, and must not consist of one repeated character.
- Error responses and logs may name invalid environment variables but must never echo configured values.
- Docker Compose must fail before startup when `AUTH_EMAIL`, `AUTH_PASSWORD`, `AUTH_SECRET`, or `POSTGRES_PASSWORD` is unset or empty.
- Docker Compose must bind the application to `127.0.0.1` by default and must not publish PostgreSQL.
- Next.js must resolve to 16.2.10 or a later unaffected 16.x patch; this implementation uses 16.2.10.
- CI must fail on high or critical production dependency vulnerabilities.
- One PR closes #1 and #2 with two logical commits; no Notion artifact exists for this project.
- E4 uses the same branch SHA for fresh Codex 5.6 Sol max, Kimi k2.7-code, and GLM 5.2 max reviews.

---

### Task 1: Fail-Closed Authentication and Docker Compose

**Files:**
- Create: `app/src/lib/auth-config.ts`
- Create: `app/src/lib/auth-config.test.ts`
- Create: `app/src/app/api/auth/login/route.test.ts`
- Create: `scripts/validate-compose-security.mjs`
- Modify: `app/src/lib/server-auth.ts`
- Modify: `app/src/app/api/auth/login/route.ts`
- Modify: `app/package.json`
- Modify: `app/package-lock.json`
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `getAuthConfig(env?: NodeJS.ProcessEnv): AuthConfig`, which throws `AuthConfigurationError` with status 503 and field names only.
- Produces: `npm test`, which runs auth configuration and login route regression tests.
- Produces: `node scripts/validate-compose-security.mjs`, which proves both negative and positive Compose resolution.

- [ ] **Step 1: Install the TypeScript test runner and define the test command**

Run:

```bash
cd app
npm install --save-dev tsx@4.23.0
npm pkg set 'scripts.test=tsx --test src/lib/auth-config.test.ts src/app/api/auth/login/route.test.ts'
```

Expected: `package.json` contains the exact `test` script and `tsx` dev dependency; the lockfile is updated.

- [ ] **Step 2: Write failing authentication configuration tests**

Create tests with Node's `node:test` and `node:assert/strict`. Cover these exact cases:

```ts
const VALID_ENV = {
  AUTH_EMAIL: "owner@company.com",
  AUTH_PASSWORD: "correct-horse-battery-staple",
  AUTH_SECRET: "0123456789abcdef0123456789abcdef",
};

test("accepts explicit strong authentication config", () => {
  assert.deepEqual(getAuthConfig(VALID_ENV), {
    email: VALID_ENV.AUTH_EMAIL,
    password: VALID_ENV.AUTH_PASSWORD,
    secret: VALID_ENV.AUTH_SECRET,
  });
});
```

Also assert `AuthConfigurationError` for missing fields, `admin@example.com`, `changeme`, passwords shorter than 12, each legacy secret (`mir-default-secret-change-me`, `mir-local-dev-secret`, `mir-docker-secret`, `change-this-to-a-random-string`), secrets shorter than 32, and a 32-character repeated string. Pass `NODE_ENV: "development"` in at least one rejected case.

- [ ] **Step 3: Write failing login route regression tests**

Use `NextRequest` and `POST` directly. Restore `process.env` after each test. Assert:

```ts
test("returns 503 for repository defaults even in development", async () => {
  process.env.NODE_ENV = "development";
  process.env.AUTH_EMAIL = "admin@example.com";
  process.env.AUTH_PASSWORD = "changeme";
  process.env.AUTH_SECRET = "mir-local-dev-secret";

  const response = await POST(loginRequest("admin@example.com", "changeme"));
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "Server authentication is not configured" });
});
```

Add a valid configuration case that returns 200 with `email` and a non-empty JWT token, and an invalid submitted password case that returns 401.

- [ ] **Step 4: Run the tests to prove the red state**

Run: `cd app && npm test`

Expected: FAIL because `auth-config.ts` does not exist and the existing route accepts development defaults.

- [ ] **Step 5: Implement the pure auth configuration boundary**

Create `auth-config.ts` with these exports and behavior:

```ts
export interface AuthConfig {
  email: string;
  password: string;
  secret: string;
}

export class AuthConfigurationError extends Error {
  readonly status = 503;
  constructor(readonly fields: string[]) {
    super("Server authentication is not configured");
  }
}

export function getAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const email = env.AUTH_EMAIL?.trim() ?? "";
  const password = env.AUTH_PASSWORD ?? "";
  const secret = env.AUTH_SECRET ?? "";
  const invalid = new Set<string>();

  if (!EMAIL_PATTERN.test(email) || BLOCKED_EMAILS.has(email.toLowerCase())) {
    invalid.add("AUTH_EMAIL");
  }
  if (password.length < 12 || BLOCKED_PASSWORDS.has(password.toLowerCase())) {
    invalid.add("AUTH_PASSWORD");
  }
  if (
    secret.length < 32 ||
    BLOCKED_SECRETS.has(secret) ||
    (secret.length > 0 && new Set(secret).size === 1)
  ) {
    invalid.add("AUTH_SECRET");
  }
  if (invalid.size > 0) {
    throw new AuthConfigurationError([...invalid]);
  }
  return { email, password, secret };
}
```

Define `EMAIL_PATTERN` as `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`; block `admin@example.com`; block `changeme`, `password`, and `password123`; block `mir-default-secret-change-me`, `mir-local-dev-secret`, `mir-docker-secret`, and `change-this-to-a-random-string`.

- [ ] **Step 6: Route all server authentication through the validated config**

In `server-auth.ts`, remove module-level fallback secrets. Call `getAuthConfig()` inside `generateToken()` and `requireUser()`, then encode the returned secret for `jose`. Update `authErrorResponse()` to map both `AuthConfigurationError` and `AuthError` while returning the configuration error's generic message.

In the login route, call `getAuthConfig()` before comparing credentials and return `authErrorResponse(error)` in the catch block. Preserve 401 for submitted credentials that do not match.

- [ ] **Step 7: Run authentication tests to prove the green state**

Run: `cd app && npm test`

Expected: all auth configuration and route tests PASS with zero failures.

- [ ] **Step 8: Write the Compose security validator before changing Compose**

Create `scripts/validate-compose-security.mjs` with this complete control flow:

```js
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const temp = mkdtempSync(join(tmpdir(), "mir-compose-security-"));
const emptyEnvFile = join(temp, "empty.env");
const safeEnvFile = join(temp, "safe.env");
const required = ["AUTH_EMAIL", "AUTH_PASSWORD", "AUTH_SECRET", "POSTGRES_PASSWORD"];
const cleanEnv = { ...process.env };
for (const name of required) delete cleanEnv[name];
writeFileSync(emptyEnvFile, "");
writeFileSync(
  safeEnvFile,
  [
    "AUTH_EMAIL=owner@company.com",
    "AUTH_PASSWORD=correct-horse-battery-staple",
    "AUTH_SECRET=0123456789abcdef0123456789abcdef",
    "POSTGRES_PASSWORD=abcdef0123456789abcdef0123456789abcdef0123456789",
    "LLM_API_KEY=test-key",
  ].join("\n") + "\n",
);

function composeConfig(envFile) {
  return spawnSync(
    "docker",
    ["compose", "--env-file", envFile, "config", "--format", "json"],
    { cwd: root, env: cleanEnv, encoding: "utf8" },
  );
}

try {
  const negative = composeConfig(emptyEnvFile);
  assert.notEqual(negative.status, 0, "Compose must reject missing required variables");
  assert.match(negative.stderr, /AUTH_EMAIL|AUTH_PASSWORD|AUTH_SECRET|POSTGRES_PASSWORD/);

  const positive = composeConfig(safeEnvFile);
  assert.equal(positive.status, 0, positive.stderr);
  const config = JSON.parse(positive.stdout);
  assert.equal(config.services.app.environment.NODE_ENV, undefined);
  assert.equal(config.services.app.ports[0].host_ip, "127.0.0.1");
  assert.equal(config.services.db.ports, undefined);
  assert.equal(config.services.app.environment.AUTH_EMAIL, "owner@company.com");
  assert.ok(!config.services.app.environment.DATABASE_URL.includes("mir:mir@"));
  console.log("Docker Compose security contract OK");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
```

- [ ] **Step 9: Run the Compose validator to prove the red state**

Run: `node scripts/validate-compose-security.mjs`

Expected: FAIL because current Compose supplies defaults, forces development, and publishes PostgreSQL.

- [ ] **Step 10: Make Compose fail closed**

Change `docker-compose.yml` to:

```yaml
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}
DATABASE_URL: postgresql://mir:${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}@db:5432/mir
AUTH_EMAIL: ${AUTH_EMAIL:?Set AUTH_EMAIL in .env}
AUTH_PASSWORD: ${AUTH_PASSWORD:?Set AUTH_PASSWORD in .env}
AUTH_SECRET: ${AUTH_SECRET:?Set AUTH_SECRET in .env}
```

Remove the app's `NODE_ENV` entry and the database `ports` section. Publish the app as `${MIR_BIND_ADDRESS:-127.0.0.1}:${MIR_PORT:-3000}:3000`.

- [ ] **Step 11: Update first-run and contributor documentation**

Set `POSTGRES_PASSWORD=`, `AUTH_EMAIL=`, `AUTH_PASSWORD=`, and `AUTH_SECRET=` in `.env.example`. Add `MIR_BIND_ADDRESS=127.0.0.1` and `MIR_PORT=3000`.

In README and CONTRIBUTING:

- require operators to fill all four values before `docker compose up`;
- provide `openssl rand -hex 24` for the URL-safe PostgreSQL password and `openssl rand -hex 32` for `AUTH_SECRET`;
- replace the fixed login with “use AUTH_EMAIL / AUTH_PASSWORD from .env”;
- document that `MIR_BIND_ADDRESS=0.0.0.0` intentionally exposes only the application and should be used behind TLS/reverse proxy;
- state that PostgreSQL is internal to the Compose network.

- [ ] **Step 12: Make Compose validation part of CI**

After `npm ci` in the frontend job, add named steps for `cd app && npm test` and `node scripts/validate-compose-security.mjs`.

- [ ] **Step 13: Run Task 1 verification**

Run:

```bash
cd app && npm test
cd ..
node scripts/validate-compose-security.mjs
docker compose --env-file /tmp/mir-security.env config --format json
```

Expected: tests PASS; validator prints a success message; resolved app bind is localhost; database has no published ports; no repository auth default appears.

- [ ] **Step 14: Commit Task 1**

```bash
git add app/src/lib/auth-config.ts app/src/lib/auth-config.test.ts \
  app/src/app/api/auth/login/route.ts app/src/app/api/auth/login/route.test.ts \
  app/src/lib/server-auth.ts app/package.json app/package-lock.json \
  scripts/validate-compose-security.mjs docker-compose.yml .env.example \
  README.md CONTRIBUTING.md .github/workflows/ci.yml
git commit -m "security: make self-hosted auth fail closed"
```

---

### Task 2: Upgrade Next.js and Enforce Dependency Audit

**Files:**
- Modify: `app/package.json`
- Modify: `app/package-lock.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`

**Interfaces:**
- Produces: a lockfile resolving `next@16.2.10`.
- Produces: a CI gate equivalent to `npm audit --omit=dev --audit-level=high`.

- [ ] **Step 1: Capture the vulnerable audit result**

Run: `cd app && npm audit --omit=dev --audit-level=high`

Expected before upgrade: exit 1 with one high-severity vulnerability in `next` affecting 16.0.0 through 16.2.5.

- [ ] **Step 2: Upgrade Next.js to the verified stable patch**

Run: `cd app && npm install next@16.2.10`

Expected: `package.json` requires `^16.2.10` and the lockfile resolves `node_modules/next` to 16.2.10.

- [ ] **Step 3: Add the production audit gate and correct documentation**

Add this named CI step after `npm ci` and before build:

```yaml
- name: Audit production dependencies
  run: cd app && npm audit --omit=dev --audit-level=high
```

Change the README Tech Stack entry from `Next.js 15` to `Next.js 16` without pinning a patch.

- [ ] **Step 4: Run Task 2 verification**

Run:

```bash
cd app
npm ci
npm test
npm audit --omit=dev --audit-level=high
npm run build
node -p "require('./node_modules/next/package.json').version"
```

Expected: tests PASS; audit reports zero vulnerabilities at high/critical and exits 0; build succeeds; printed version is `16.2.10`.

- [ ] **Step 5: Commit Task 2**

```bash
git add app/package.json app/package-lock.json .github/workflows/ci.yml README.md
git commit -m "security: upgrade Next.js and gate dependency audits"
```

---

### Task 3: Whole-Branch Validation and Pull Request

**Files:**
- Verify only; modify files only when a failed check proves a defect in Tasks 1 or 2.

**Interfaces:**
- Produces: a pushed branch and PR closing issues #1 and #2.

- [ ] **Step 1: Run the full local validation matrix**

```bash
cd app && npm ci && npm test && npm audit --omit=dev --audit-level=high && npm run build
cd ..
node scripts/validate-compose-security.mjs
.venv/bin/python -m compileall -q mir
.venv/bin/python -c "import mir.scanner; import mir.enricher; import mir.classifier; import mir.icp_policy; import mir.matcher; import mir.crm_import; import mir.llm; import mir.pg_storage; import mir.db; import mir.icps; import mir.exclusions; import mir.scraper; import mir.extractor; import mir.sources; import mir.rate_limit; import mir.data_paths; print('All module imports OK')"
docker compose --env-file /tmp/mir-security.env build
```

Expected: every command exits 0; audit has no high/critical findings; build identifies Next.js 16.2.10.

- [ ] **Step 2: Run an isolated Compose smoke test**

Use a unique Compose project name and safe temporary environment. Start the stack, wait for the health check, submit one invalid login expecting 401 and one valid login expecting 200 with a token, then run `docker compose down -v` for that unique project.

- [ ] **Step 3: Verify scope and push**

Run `git diff --check`, inspect `git status --short`, and compare `git diff origin/main...HEAD` against issues #1 and #2. Push `codex/security-hardening`.

- [ ] **Step 4: Open the pull request**

The PR body must contain `Closes #1`, `Closes #2`, the no-Notion note, implementation summary, exact validation commands/results, security migration note, and E4 reviewer contract.

- [ ] **Step 5: Run E4 and merge only after the gate closes**

Review the same final SHA with fresh Codex 5.6 Sol max, Kimi k2.7-code, and GLM 5.2 max using the shared P0-P4 rubric. Resolve every finding explicitly, re-run affected checks and all three reviewers after any code change, require CI green, then merge using the repository's established method.

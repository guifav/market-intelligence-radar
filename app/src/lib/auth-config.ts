const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BLOCKED_EMAILS = new Set(["admin@example.com"]);
const BLOCKED_PASSWORDS = new Set(["changeme", "password", "password123"]);
const BLOCKED_SECRETS = new Set([
  "mir-default-secret-change-me",
  "mir-local-dev-secret",
  "mir-docker-secret",
  "change-this-to-a-random-string",
  "replace-with-a-strong-random-secret",
]);

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
  const email = env.AUTH_EMAIL ?? "";
  const normalizedEmail = email.toLowerCase();
  const password = env.AUTH_PASSWORD ?? "";
  const secret = env.AUTH_SECRET ?? "";
  const invalid = new Set<string>();

  if (
    email !== email.trim() ||
    !EMAIL_PATTERN.test(email) ||
    BLOCKED_EMAILS.has(normalizedEmail)
  ) {
    invalid.add("AUTH_EMAIL");
  }
  if (
    password !== password.trim() ||
    password.length < 12 ||
    BLOCKED_PASSWORDS.has(password.toLowerCase())
  ) {
    invalid.add("AUTH_PASSWORD");
  }
  if (
    secret !== secret.trim() ||
    secret.length < 32 ||
    BLOCKED_SECRETS.has(secret.toLowerCase()) ||
    (secret.length > 0 && new Set(secret).size === 1)
  ) {
    invalid.add("AUTH_SECRET");
  }
  if (invalid.size > 0) {
    throw new AuthConfigurationError([...invalid]);
  }
  return { email: normalizedEmail, password, secret };
}

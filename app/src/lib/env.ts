export function requireEnv(name: string): string {
  const val = process.env[name];
  if (val) return val;
  return "";
}

export function assertEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
}

import { Pool, type PoolConfig } from "pg";

let pool: Pool | null = null;

export function getPoolOptions(env: NodeJS.ProcessEnv = process.env): PoolConfig {
  if (env.DATABASE_URL) {
    return { connectionString: env.DATABASE_URL, max: 10 };
  }
  return { max: 10 };
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(getPoolOptions());
  }
  return pool;
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] || null;
}

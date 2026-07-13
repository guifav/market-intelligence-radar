import assert from "node:assert/strict";
import test from "node:test";

import { getPoolOptions } from "./db";

test("uses DATABASE_URL when manual setup provides one", () => {
  assert.deepEqual(getPoolOptions({ DATABASE_URL: "postgresql://external.example/mir" }), {
    connectionString: "postgresql://external.example/mir",
    max: 10,
  });
});

test("omits connectionString so node-postgres consumes libpq PG variables", () => {
  const options = getPoolOptions({
    PGHOST: "db",
    PGPORT: "5432",
    PGDATABASE: "mir",
    PGUSER: "mir",
    PGPASSWORD: "p@ss#word%/?",
  });

  assert.deepEqual(options, { max: 10 });
  assert.equal("connectionString" in options, false);
});

"""Unit tests for PostgreSQL connection configuration."""

import os
import unittest
from unittest.mock import patch

from mir import db


class DatabasePoolConfigurationTests(unittest.TestCase):
    def setUp(self):
        self.original_database_url = db.config.DATABASE_URL
        db._pool = None

    def tearDown(self):
        db.config.DATABASE_URL = self.original_database_url
        db._pool = None

    @patch("mir.db.pool.ThreadedConnectionPool")
    def test_uses_database_url_loaded_by_mir_config(self, pool_factory):
        database_url = "postgresql://mir:encoded-password@localhost:5432/mir"
        db.config.DATABASE_URL = database_url

        result = db.get_pool()

        pool_factory.assert_called_once_with(
            minconn=1,
            maxconn=10,
            dsn=database_url,
        )
        self.assertIs(result, pool_factory.return_value)

    @patch.dict(
        os.environ,
        {
            "PGHOST": "db",
            "PGPORT": "5432",
            "PGDATABASE": "mir",
            "PGUSER": "mir",
            "PGPASSWORD": "p@ss$word#%?/-exact",
        },
        clear=False,
    )
    @patch("mir.db.pool.ThreadedConnectionPool")
    def test_uses_libpq_pg_environment_when_database_url_is_empty(self, pool_factory):
        db.config.DATABASE_URL = ""

        result = db.get_pool()

        pool_factory.assert_called_once_with(minconn=1, maxconn=10)
        self.assertEqual(os.environ["PGPASSWORD"], "p@ss$word#%?/-exact")
        self.assertIs(result, pool_factory.return_value)


if __name__ == "__main__":
    unittest.main()

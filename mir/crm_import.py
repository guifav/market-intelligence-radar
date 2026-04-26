"""CRM Contact Importer — reads CSV into crm_contacts table.

Expected CSV columns: id, name, email, company, title

Usage:
    python3 -m mir.crm_import contacts.csv
"""

import csv
import logging
import sys
from pathlib import Path

from mir.db import execute, get_conn, put_conn

log = logging.getLogger("mir.crm_import")


def import_csv(filepath: str, clear_existing: bool = False) -> int:
    """Import CRM contacts from a CSV file.

    Args:
        filepath: Path to CSV file
        clear_existing: If True, truncate table before import

    Returns:
        Number of contacts imported
    """
    path = Path(filepath)
    if not path.exists():
        raise FileNotFoundError(f"CSV file not found: {filepath}")

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            if clear_existing:
                cur.execute("TRUNCATE crm_contacts")
                log.info("Cleared existing CRM contacts")

            count = 0
            with open(path, newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    cid = (row.get("id") or "").strip()
                    name = (row.get("name") or "").strip()
                    if not cid or not name:
                        continue
                    cur.execute("""
                        INSERT INTO crm_contacts (id, name, email, company, title)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO UPDATE SET
                            name=EXCLUDED.name, email=EXCLUDED.email,
                            company=EXCLUDED.company, title=EXCLUDED.title,
                            imported_at=NOW()
                    """, (
                        cid, name,
                        (row.get("email") or "").strip() or None,
                        (row.get("company") or "").strip() or None,
                        (row.get("title") or "").strip() or None,
                    ))
                    count += 1

        conn.commit()
        log.info(f"Imported {count} CRM contacts from {filepath}")
        return count
    except Exception:
        conn.rollback()
        raise
    finally:
        put_conn(conn)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    if len(sys.argv) < 2:
        print("Usage: python3 -m mir.crm_import <contacts.csv> [--clear]")
        sys.exit(1)
    clear = "--clear" in sys.argv
    count = import_csv(sys.argv[1], clear_existing=clear)
    print(f"Done. Imported {count} contacts.")

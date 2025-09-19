import os
import mysql.connector
from pathlib import Path
from dotenv import load_dotenv


def main():
    # Load env from backend/.env
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if env_path.exists():
        load_dotenv(env_path)

    db_host = os.getenv("DB_HOST", "localhost")
    db_port = int(os.getenv("DB_PORT", "3306"))
    db_user = os.getenv("DB_USER", "root")
    db_password = os.getenv("DB_PASSWORD", "")
    db_name = os.getenv("DB_NAME", "expense_tracker")

    # Connect without database to create it if needed
    conn = mysql.connector.connect(host=db_host, port=db_port, user=db_user, password=db_password)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(f"CREATE DATABASE IF NOT EXISTS `{db_name}` CHARACTER SET utf8mb4")
    cur.close()
    conn.close()

    # Now connect to the database and run schema
    conn = mysql.connector.connect(host=db_host, port=db_port, user=db_user, password=db_password, database=db_name)
    conn.autocommit = True
    cur = conn.cursor()

    schema_path = Path(__file__).resolve().parents[1] / "migrations" / "schema.sql"
    sql = schema_path.read_text(encoding="utf-8")
    # Split by ; while preserving statements (simple split works for our schema)
    statements = [s.strip() for s in sql.split(";") if s.strip()]
    for s in statements:
        cur.execute(s)
    cur.close()
    conn.close()
    print("Database initialized.")


if __name__ == "__main__":
    main()



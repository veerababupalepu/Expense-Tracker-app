```python
import os
from pathlib import Path

import mysql.connector
from dotenv import load_dotenv


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[1]

ENV_PATH = BASE_DIR / ".env"

SCHEMA_PATH = (
    BASE_DIR
    / "migrations"
    / "schema.sql"
)


# ============================================================
# LOAD ENVIRONMENT VARIABLES
# ============================================================

if ENV_PATH.exists():

    load_dotenv(
        ENV_PATH
    )

else:

    # Useful for cloud deployment platforms
    # where environment variables are configured
    # directly in the hosting dashboard.

    load_dotenv()


# ============================================================
# DATABASE CONFIGURATION
# ============================================================

DB_HOST = os.getenv(
    "DB_HOST",
    "localhost"
)

DB_PORT = int(
    os.getenv(
        "DB_PORT",
        "3306"
    )
)

DB_USER = os.getenv(
    "DB_USER",
    "root"
)

DB_PASSWORD = os.getenv(
    "DB_PASSWORD",
    ""
)

DB_NAME = os.getenv(
    "DB_NAME",
    "expense_tracker"
)


# ============================================================
# DATABASE CONNECTION
# ============================================================

def create_server_connection():

    return mysql.connector.connect(

        host=DB_HOST,

        port=DB_PORT,

        user=DB_USER,

        password=DB_PASSWORD

    )


def create_database_connection():

    return mysql.connector.connect(

        host=DB_HOST,

        port=DB_PORT,

        user=DB_USER,

        password=DB_PASSWORD,

        database=DB_NAME

    )


# ============================================================
# CREATE DATABASE
# ============================================================

def create_database():

    connection = None
    cursor = None

    try:

        print(
            f"Connecting to MySQL at "
            f"{DB_HOST}:{DB_PORT}..."
        )

        connection = (
            create_server_connection()
        )

        connection.autocommit = True

        cursor = connection.cursor()

        # DB_NAME comes from the environment.
        # Backticks protect the identifier.

        cursor.execute(
            f"""
            CREATE DATABASE IF NOT EXISTS
            `{DB_NAME}`
            CHARACTER SET utf8mb4
            COLLATE utf8mb4_unicode_ci
            """
        )

        print(
            f"Database '{DB_NAME}' is ready."
        )

    finally:

        if cursor:

            cursor.close()

        if connection:

            connection.close()


# ============================================================
# EXECUTE SCHEMA
# ============================================================

def execute_schema():

    if not SCHEMA_PATH.exists():

        raise FileNotFoundError(
            f"Schema file not found: "
            f"{SCHEMA_PATH}"
        )


    sql = SCHEMA_PATH.read_text(
        encoding="utf-8"
    )


    connection = None
    cursor = None


    try:

        connection = (
            create_database_connection()
        )

        connection.autocommit = True

        cursor = connection.cursor()


        # ----------------------------------------------------
        # Remove SQL comments
        # ----------------------------------------------------

        cleaned_lines = []

        for line in sql.splitlines():

            stripped = line.strip()

            if not stripped:
                continue

            if stripped.startswith("--"):
                continue

            cleaned_lines.append(
                line
            )


        cleaned_sql = "\n".join(
            cleaned_lines
        )


        # ----------------------------------------------------
        # Execute statements
        # ----------------------------------------------------

        statements = [
            statement.strip()
            for statement
            in cleaned_sql.split(";")
            if statement.strip()
        ]


        print(
            f"Found {len(statements)} "
            f"SQL statements."
        )


        for index, statement in enumerate(
            statements,
            start=1
        ):

            try:

                cursor.execute(
                    statement
                )

                print(
                    f"✓ Statement {index} executed."
                )

            except mysql.connector.Error as error:

                print(
                    f"✗ Statement {index} failed:"
                )

                print(error)

                raise


    finally:

        if cursor:

            cursor.close()

        if connection:

            connection.close()


# ============================================================
# MAIN
# ============================================================

def main():

    print()
    print(
        "=========================================="
    )
    print(
        "     VH EXPENSE TRACKER DATABASE SETUP"
    )
    print(
        "=========================================="
    )
    print()


    try:

        # Step 1
        create_database()


        # Step 2
        execute_schema()


        print()
        print(
            "=========================================="
        )
        print(
            "Database initialized successfully!"
        )
        print(
            "=========================================="
        )
        print()


    except mysql.connector.Error as error:

        print()
        print(
            "Database initialization failed."
        )
        print(
            f"MySQL Error: {error}"
        )
        print()

        raise


    except Exception as error:

        print()
        print(
            "Database initialization failed."
        )
        print(
            f"Error: {error}"
        )
        print()

        raise


# ============================================================
# ENTRY POINT
# ============================================================

if __name__ == "__main__":

    main()
```

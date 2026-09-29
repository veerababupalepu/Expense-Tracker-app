```python
from flask import Flask
from flask_cors import CORS
import mysql.connector
from mysql.connector import pooling
from config import Config
from dotenv import load_dotenv
from pathlib import Path
import os


# ============================================================
# DATABASE CONNECTION POOL
# ============================================================

connection_pool = None


def init_db_pool(config):
    """
    Initialize the MySQL connection pool once.
    """

    global connection_pool

    if connection_pool is not None:
        return

    try:
        connection_pool = pooling.MySQLConnectionPool(
            pool_name="expense_pool",
            pool_size=5,
            pool_reset_session=True,

            host=config.DB_HOST,
            port=config.DB_PORT,
            user=config.DB_USER,
            password=config.DB_PASSWORD,
            database=config.DB_NAME,

            charset="utf8mb4",
            autocommit=True
        )

        print("MySQL connection pool initialized successfully.")

    except mysql.connector.Error as error:

        print(
            f"Database connection pool initialization failed: {error}"
        )

        raise


def get_db_connection():
    """
    Get a connection from the MySQL pool.
    """

    if connection_pool is None:
        raise RuntimeError(
            "Database connection pool has not been initialized."
        )

    connection = connection_pool.get_connection()

    if not connection.is_connected():

        connection.reconnect(
            attempts=3,
            delay=1
        )

    return connection


# ============================================================
# APPLICATION FACTORY
# ============================================================

def create_app() -> Flask:

    # --------------------------------------------------------
    # Load environment variables
    # --------------------------------------------------------

    env_path = (
        Path(__file__)
        .resolve()
        .parents[1]
        / ".env"
    )

    if env_path.exists():

        load_dotenv(env_path)

        print(
            f"Loaded environment variables from: {env_path}"
        )

    else:

        # Also support deployment platforms such as
        # Vercel / Render / Railway where environment
        # variables are configured directly.

        load_dotenv()


    # --------------------------------------------------------
    # Create Flask application
    # --------------------------------------------------------

    app = Flask(__name__)

    app.config.from_object(Config)


    # --------------------------------------------------------
    # CORS
    # --------------------------------------------------------

    cors_origins = app.config.get(
        "CORS_ORIGINS",
        "*"
    )

    # Allow either:
    #
    # CORS_ORIGINS = "*"
    #
    # or:
    #
    # CORS_ORIGINS = [
    #     "https://your-vercel-domain.vercel.app"
    # ]

    if isinstance(cors_origins, str):

        if cors_origins.strip() == "*":

            cors_origins = "*"

        else:

            cors_origins = [
                origin.strip()
                for origin in cors_origins.split(",")
                if origin.strip()
            ]


    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": cors_origins,
                "methods": [
                    "GET",
                    "POST",
                    "PUT",
                    "DELETE",
                    "OPTIONS"
                ],
                "allow_headers": [
                    "Content-Type",
                    "Authorization"
                ]
            }
        }
    )


    # --------------------------------------------------------
    # Database
    # --------------------------------------------------------

    init_db_pool(Config)


    # --------------------------------------------------------
    # API Routes
    # --------------------------------------------------------

    from .routes import api_bp

    app.register_blueprint(
        api_bp,
        url_prefix="/api"
    )


    # ========================================================
    # HEALTH CHECK
    # ========================================================

    @app.get("/health")
    def health():

        return {
            "status": "ok",
            "service": "expense-tracker-api"
        }


    # ========================================================
    # API HEALTH CHECK
    # ========================================================

    @app.get("/api/health")
    def api_health():

        database_status = "unknown"

        connection = None

        try:

            connection = get_db_connection()

            cursor = connection.cursor()

            cursor.execute(
                "SELECT 1"
            )

            cursor.fetchone()

            cursor.close()

            database_status = "connected"

        except Exception as error:

            print(
                f"Database health check failed: {error}"
            )

            database_status = "error"

        finally:

            if connection:

                try:
                    connection.close()
                except Exception:
                    pass


        return {
            "status": "ok",
            "database": database_status
        }


    # ========================================================
    # ERROR HANDLERS
    # ========================================================

    @app.errorhandler(404)
    def not_found(error):

        return {
            "error": "Resource not found"
        }, 404


    @app.errorhandler(500)
    def internal_error(error):

        return {
            "error": "Internal server error"
        }, 500


    # ========================================================
    # STARTUP MESSAGE
    # ========================================================

    print(
        "=========================================="
    )

    print(
        "VH Expense Tracker API started"
    )

    print(
        "=========================================="
    )

    return app
```

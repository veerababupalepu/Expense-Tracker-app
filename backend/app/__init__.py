from flask import Flask
from flask_cors import CORS
import mysql.connector
from mysql.connector import pooling
from config import Config
from dotenv import load_dotenv
from pathlib import Path


connection_pool = None


def init_db_pool(config: Config):
    global connection_pool
    if connection_pool is None:
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
            autocommit=True,
        )


def get_db_connection():
    if connection_pool is None:
        raise RuntimeError("Database pool not initialized")
    return connection_pool.get_connection()


def create_app() -> Flask:
    # Load .env early for config
    env_path = Path(__file__).resolve().parents[1] / ".env"
    if env_path.exists():
        load_dotenv(env_path)

    app = Flask(__name__)
    app.config.from_object(Config)

    # CORS
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    # DB pool
    init_db_pool(Config)

    # Import and register API routes after helpers are defined to avoid circular import
    from .routes import api_bp  # noqa: WPS433
    app.register_blueprint(api_bp, url_prefix="/api")

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app



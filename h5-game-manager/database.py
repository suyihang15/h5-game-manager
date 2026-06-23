"""
Database initialization, schema creation, and connection management.
Uses SQLite with WAL mode for better concurrent access.
"""

import sqlite3
import os
import bcrypt

DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
DB_PATH = os.path.join(DB_DIR, 'games.db')


def get_db():
    """Get a database connection with WAL mode enabled."""
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Create database tables if they don't exist and seed default data."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            username    TEXT NOT NULL UNIQUE,
            password    TEXT NOT NULL,
            role        TEXT NOT NULL DEFAULT 'admin',
            avatar      TEXT DEFAULT NULL,
            is_active   INTEGER NOT NULL DEFAULT 1,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS categories (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL UNIQUE,
            slug        TEXT NOT NULL UNIQUE,
            description TEXT DEFAULT '',
            icon        TEXT DEFAULT 'bi-folder',
            sort_order  INTEGER NOT NULL DEFAULT 0,
            is_active   INTEGER NOT NULL DEFAULT 1,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS games (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            title       TEXT NOT NULL,
            slug        TEXT NOT NULL UNIQUE,
            description TEXT DEFAULT '',
            icon_path   TEXT DEFAULT NULL,
            screenshot  TEXT DEFAULT NULL,
            url         TEXT NOT NULL,
            category_id INTEGER DEFAULT NULL,
            status      TEXT NOT NULL DEFAULT 'draft',
            play_count  INTEGER NOT NULL DEFAULT 0,
            is_featured INTEGER NOT NULL DEFAULT 0,
            is_local    INTEGER NOT NULL DEFAULT 0,
            sort_order  INTEGER NOT NULL DEFAULT 0,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS play_records (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id     INTEGER NOT NULL,
            played_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            duration    INTEGER DEFAULT 0,
            FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS settings (
            key         TEXT PRIMARY KEY,
            value       TEXT NOT NULL,
            updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Seed default admin user if none exists
    existing = cursor.execute("SELECT id FROM users WHERE username = 'admin'").fetchone()
    if not existing:
        hashed = bcrypt.hashpw('admin123'.encode('utf-8'), bcrypt.gensalt())
        cursor.execute(
            "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
            ('admin', hashed.decode('utf-8'), 'superadmin')
        )

    # Seed default categories if none exist
    cat_count = cursor.execute("SELECT COUNT(*) FROM categories").fetchone()[0]
    if cat_count == 0:
        default_categories = [
            ('动作游戏', 'action', '动作类H5游戏', 'bi-joystick', 1),
            ('益智游戏', 'puzzle', '益智解谜类H5游戏', 'bi-puzzle', 2),
            ('休闲游戏', 'casual', '休闲娱乐类H5游戏', 'bi-cup-hot', 3),
            ('冒险游戏', 'adventure', '冒险探索类H5游戏', 'bi-compass', 4),
            ('射击游戏', 'shooter', '射击类H5游戏', 'bi-crosshair', 5),
        ]
        cursor.executemany(
            "INSERT INTO categories (name, slug, description, icon, sort_order) VALUES (?, ?, ?, ?, ?)",
            default_categories
        )

    # Migration: add is_local column if not exists (for older databases)
    try:
        cursor.execute("ALTER TABLE games ADD COLUMN is_local INTEGER NOT NULL DEFAULT 0")
    except sqlite3.OperationalError:
        pass  # Column already exists

    # Seed default settings
    default_settings = [
        ('app_name', 'H5游戏管理器'),
        ('app_description', '可视化管理你的HTML5游戏项目'),
        ('games_per_page', '12'),
        ('default_status', 'draft'),
        ('theme', 'dark'),
    ]
    for key, value in default_settings:
        cursor.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
            (key, value)
        )

    conn.commit()
    conn.close()


if __name__ == '__main__':
    init_db()
    print(f"Database initialized at: {DB_PATH}")

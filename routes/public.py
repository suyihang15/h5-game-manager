"""
Public API routes for app settings.
"""

from flask import Blueprint, request, jsonify
from auth import require_admin
from database import get_db

public_bp = Blueprint('public', __name__)


@public_bp.route('/api/public/settings', methods=['GET'])
def get_settings():
    """Get public app settings."""
    db = get_db()
    settings = db.execute("SELECT key, value FROM settings").fetchall()
    db.close()

    return jsonify({row['key']: row['value'] for row in settings})


@public_bp.route('/api/admin/settings', methods=['PUT'])
@require_admin
def update_settings():
    """Update app settings (admin only)."""
    data = request.get_json()
    if not data:
        return jsonify({'error': '请提供设置信息'}), 400

    db = get_db()
    for key, value in data.items():
        db.execute(
            """INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
               ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP""",
            (key, str(value), str(value))
        )
    db.commit()

    # Return updated settings
    settings = db.execute("SELECT key, value FROM settings").fetchall()
    db.close()

    return jsonify({row['key']: row['value'] for row in settings})

"""
User management API routes (admin only).
"""

from flask import Blueprint, request, jsonify, g
import bcrypt
from auth import require_auth, require_admin
from database import get_db

users_bp = Blueprint('users', __name__)


@users_bp.route('/api/admin/users', methods=['GET'])
@require_admin
def list_users():
    """List all admin users."""
    db = get_db()
    users = db.execute(
        "SELECT id, username, role, avatar, is_active, created_at, updated_at FROM users ORDER BY created_at ASC"
    ).fetchall()
    db.close()
    return jsonify([dict(row) for row in users])


@users_bp.route('/api/admin/users', methods=['POST'])
@require_admin
def create_user():
    """Create a new admin user."""
    data = request.get_json()
    if not data:
        return jsonify({'error': '请提供用户信息'}), 400

    username = data.get('username', '').strip()
    password = data.get('password', '').strip()
    role = data.get('role', 'admin')

    if not username or len(username) < 3:
        return jsonify({'error': '用户名至少需要3个字符'}), 400
    if not password or len(password) < 6:
        return jsonify({'error': '密码至少需要6个字符'}), 400
    if role not in ('admin', 'superadmin'):
        return jsonify({'error': '无效的角色'}), 400

    db = get_db()
    existing = db.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    if existing:
        db.close()
        return jsonify({'error': '用户名已存在'}), 409

    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

    cursor = db.execute(
        "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
        (username, hashed.decode('utf-8'), role)
    )
    db.commit()

    new_user = db.execute(
        "SELECT id, username, role, avatar, is_active, created_at, updated_at FROM users WHERE id = ?",
        (cursor.lastrowid,)
    ).fetchone()
    db.close()

    return jsonify(dict(new_user)), 201


@users_bp.route('/api/admin/users/<int:user_id>', methods=['PUT'])
@require_admin
def update_user(user_id):
    """Update an admin user."""
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()

    if not user:
        db.close()
        return jsonify({'error': '用户不存在'}), 404

    # Prevent editing the last superadmin
    if user['role'] == 'superadmin' and g.user['user_id'] != user_id:
        db.close()
        return jsonify({'error': '不能修改其他超级管理员'}), 403

    data = request.get_json()
    if not data:
        db.close()
        return jsonify({'error': '请提供更新信息'}), 400

    username = data.get('username', user['username']).strip()
    role = data.get('role', user['role'])
    is_active = data.get('is_active', user['is_active'])
    if isinstance(is_active, bool):
        is_active = 1 if is_active else 0

    # Check username uniqueness
    conflict = db.execute(
        "SELECT id FROM users WHERE username = ? AND id != ?",
        (username, user_id)
    ).fetchone()
    if conflict:
        db.close()
        return jsonify({'error': '用户名已存在'}), 409

    db.execute(
        """UPDATE users SET username=?, role=?, is_active=?, updated_at=CURRENT_TIMESTAMP
           WHERE id=?""",
        (username, role, is_active, user_id)
    )

    # Update password if provided
    password = data.get('password', '').strip()
    if password:
        if len(password) < 6:
            db.close()
            return jsonify({'error': '密码至少需要6个字符'}), 400
        hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        db.execute("UPDATE users SET password = ? WHERE id = ?",
                   (hashed.decode('utf-8'), user_id))

    db.commit()

    updated = db.execute(
        "SELECT id, username, role, avatar, is_active, created_at, updated_at FROM users WHERE id = ?",
        (user_id,)
    ).fetchone()
    db.close()

    return jsonify(dict(updated))


@users_bp.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@require_admin
def delete_user(user_id):
    """Delete a user (cannot delete self or the last superadmin)."""
    if g.user['user_id'] == user_id:
        return jsonify({'error': '不能删除自己'}), 400

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()

    if not user:
        db.close()
        return jsonify({'error': '用户不存在'}), 404

    if user['role'] == 'superadmin':
        # Check if this is the last superadmin
        sa_count = db.execute(
            "SELECT COUNT(*) FROM users WHERE role = 'superadmin'"
        ).fetchone()[0]
        if sa_count <= 1:
            db.close()
            return jsonify({'error': '不能删除最后一个超级管理员'}), 403

    db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    db.commit()
    db.close()

    return jsonify({'message': '用户已删除'})

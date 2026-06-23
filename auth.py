"""
Authentication module: JWT token generation, verification, and login endpoint.
"""

import jwt
import bcrypt
import datetime
from functools import wraps
from flask import Blueprint, request, jsonify, g
from database import get_db

auth_bp = Blueprint('auth', __name__)

# Secret key for JWT signing (in production, use a proper secret)
SECRET_KEY = 'h5-game-manager-secret-key-2024-very-secure!'
TOKEN_EXPIRY_HOURS = 24


def generate_token(user_id, username, role):
    """Generate a JWT token for the given user."""
    payload = {
        'user_id': user_id,
        'username': username,
        'role': role,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=TOKEN_EXPIRY_HOURS),
        'iat': datetime.datetime.utcnow(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')


def verify_token(token):
    """Verify a JWT token and return the payload, or None if invalid."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def require_auth(f):
    """Decorator to require valid JWT token for a route."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]

        if not token:
            return jsonify({'error': '未提供认证令牌'}), 401

        payload = verify_token(token)
        if not payload:
            return jsonify({'error': '认证令牌无效或已过期'}), 401

        g.user = payload
        return f(*args, **kwargs)
    return decorated


def require_admin(f):
    """Decorator to require admin role."""
    @wraps(f)
    @require_auth
    def decorated(*args, **kwargs):
        if g.user.get('role') not in ('admin', 'superadmin'):
            return jsonify({'error': '需要管理员权限'}), 403
        return f(*args, **kwargs)
    return decorated


@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    """Authenticate user and return JWT token."""
    data = request.get_json()
    if not data:
        return jsonify({'error': '请提供登录信息'}), 400

    username = data.get('username', '').strip()
    password = data.get('password', '').strip()

    if not username or not password:
        return jsonify({'error': '用户名和密码不能为空'}), 400

    db = get_db()
    user = db.execute(
        "SELECT id, username, password, role, is_active FROM users WHERE username = ?",
        (username,)
    ).fetchone()
    db.close()

    if not user:
        return jsonify({'error': '用户名或密码错误'}), 401

    if not user['is_active']:
        return jsonify({'error': '该账号已被禁用'}), 403

    if not bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
        return jsonify({'error': '用户名或密码错误'}), 401

    token = generate_token(user['id'], user['username'], user['role'])

    return jsonify({
        'token': token,
        'user': {
            'id': user['id'],
            'username': user['username'],
            'role': user['role'],
        }
    })


@auth_bp.route('/api/auth/verify', methods=['GET'])
@require_auth
def verify():
    """Verify that the current token is valid."""
    db = get_db()
    user = db.execute(
        "SELECT id, username, role, is_active FROM users WHERE id = ?",
        (g.user['user_id'],)
    ).fetchone()
    db.close()

    if not user or not user['is_active']:
        return jsonify({'error': '用户不存在或已禁用'}), 403

    return jsonify({
        'user': {
            'id': user['id'],
            'username': user['username'],
            'role': user['role'],
        }
    })

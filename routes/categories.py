"""
Category CRUD API routes.
"""

from flask import Blueprint, request, jsonify, g
from slugify import slugify
from auth import require_auth, require_admin
from database import get_db

categories_bp = Blueprint('categories', __name__)


@categories_bp.route('/api/categories', methods=['GET'])
@require_admin
def list_categories():
    """List all categories with game counts."""
    db = get_db()
    categories = db.execute("""
        SELECT c.*, COUNT(g.id) as game_count
        FROM categories c
        LEFT JOIN games g ON g.category_id = c.id
        GROUP BY c.id
        ORDER BY c.sort_order ASC, c.name ASC
    """).fetchall()
    db.close()
    return jsonify([dict(row) for row in categories])


@categories_bp.route('/api/categories/<slug>', methods=['GET'])
@require_admin
def get_category(slug):
    """Get a single category by slug."""
    db = get_db()
    category = db.execute(
        "SELECT * FROM categories WHERE slug = ?", (slug,)
    ).fetchone()
    db.close()

    if not category:
        return jsonify({'error': '分类不存在'}), 404

    return jsonify(dict(category))


@categories_bp.route('/api/categories', methods=['POST'])
@require_admin
def create_category():
    """Create a new category."""
    data = request.get_json()
    if not data:
        return jsonify({'error': '请提供分类信息'}), 400

    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': '分类名称不能为空'}), 400

    slug = data.get('slug', '').strip()
    if not slug:
        slug = slugify(name)

    # Check uniqueness
    db = get_db()
    existing = db.execute(
        "SELECT id FROM categories WHERE slug = ? OR name = ?", (slug, name)
    ).fetchone()
    if existing:
        db.close()
        return jsonify({'error': '分类名称或标识已存在'}), 409

    description = data.get('description', '')
    icon = data.get('icon', 'bi-folder')
    sort_order = data.get('sort_order', 0)
    is_active = 1 if data.get('is_active', True) else 0

    cursor = db.execute(
        """INSERT INTO categories (name, slug, description, icon, sort_order, is_active)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (name, slug, description, icon, sort_order, is_active)
    )
    db.commit()

    new_cat = db.execute("SELECT * FROM categories WHERE id = ?", (cursor.lastrowid,)).fetchone()
    db.close()

    return jsonify(dict(new_cat)), 201


@categories_bp.route('/api/categories/<slug>', methods=['PUT'])
@require_admin
def update_category(slug):
    """Update an existing category."""
    db = get_db()
    category = db.execute(
        "SELECT * FROM categories WHERE slug = ?", (slug,)
    ).fetchone()

    if not category:
        db.close()
        return jsonify({'error': '分类不存在'}), 404

    data = request.get_json()
    if not data:
        db.close()
        return jsonify({'error': '请提供更新信息'}), 400

    name = data.get('name', category['name']).strip()
    new_slug = data.get('slug', category['slug']).strip()
    description = data.get('description', category['description'])
    icon = data.get('icon', category['icon'])
    sort_order = data.get('sort_order', category['sort_order'])
    is_active = data.get('is_active', category['is_active'])
    if isinstance(is_active, bool):
        is_active = 1 if is_active else 0

    # Check uniqueness (exclude self)
    conflict = db.execute(
        "SELECT id FROM categories WHERE (slug = ? OR name = ?) AND id != ?",
        (new_slug, name, category['id'])
    ).fetchone()
    if conflict:
        db.close()
        return jsonify({'error': '分类名称或标识已被使用'}), 409

    db.execute(
        """UPDATE categories SET name=?, slug=?, description=?, icon=?,
           sort_order=?, is_active=?, updated_at=CURRENT_TIMESTAMP
           WHERE id=?""",
        (name, new_slug, description, icon, sort_order, is_active, category['id'])
    )
    db.commit()

    updated = db.execute("SELECT * FROM categories WHERE id = ?", (category['id'],)).fetchone()
    db.close()

    return jsonify(dict(updated))


@categories_bp.route('/api/categories/<slug>', methods=['DELETE'])
@require_admin
def delete_category(slug):
    """Delete a category. Games in this category become uncategorized."""
    db = get_db()
    category = db.execute(
        "SELECT * FROM categories WHERE slug = ?", (slug,)
    ).fetchone()

    if not category:
        db.close()
        return jsonify({'error': '分类不存在'}), 404

    # Set games in this category to NULL (uncategorized)
    db.execute(
        "UPDATE games SET category_id = NULL WHERE category_id = ?",
        (category['id'],)
    )
    db.execute("DELETE FROM categories WHERE id = ?", (category['id'],))
    db.commit()
    db.close()

    return jsonify({'message': '分类已删除'})

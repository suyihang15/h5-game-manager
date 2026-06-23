"""
Game CRUD API routes: CRUD, icon upload, zip package import, import/export, game file serving.
"""

import os
import json
import uuid
import zipfile
import tarfile
import shutil
from flask import Blueprint, request, jsonify, g, send_from_directory
from slugify import slugify
from PIL import Image
from auth import require_auth, require_admin
from database import get_db

games_bp = Blueprint('games', __name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOADS_DIR = os.path.join(BASE_DIR, 'uploads')
ICONS_DIR = os.path.join(UPLOADS_DIR, 'icons')
GAMES_DIR = os.path.join(BASE_DIR, 'games')

# Entry point filenames to look for when importing a game package
ENTRY_CANDIDATES = ['index.html', 'game.html', 'main.html', 'index.htm', 'play.html', 'start.html']


def save_icon(file):
    """Save an uploaded icon, resize to 256x256, return relative path."""
    os.makedirs(ICONS_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename)[1] or '.png'
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(ICONS_DIR, filename)
    img = Image.open(file)
    img = img.convert('RGBA')
    img.thumbnail((256, 256), Image.LANCZOS)
    canvas = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
    offset = ((256 - img.width) // 2, (256 - img.height) // 2)
    canvas.paste(img, offset, img if img.mode == 'RGBA' else None)
    canvas.save(filepath, 'PNG')
    return f"icons/{filename}"


def extract_game_package(file, slug):
    """
    Extract a game package (zip / tar.gz / tgz) to games/<slug>/.
    Returns (entry_path, file_list) where entry_path is the local URL path
    to the detected entry point, or None if not found.
    """
    game_dir = os.path.join(GAMES_DIR, slug)

    # Clean up existing directory if present
    if os.path.exists(game_dir):
        shutil.rmtree(game_dir)
    os.makedirs(game_dir, exist_ok=True)

    filename = file.filename.lower()
    file_bytes = file.read()

    try:
        if filename.endswith('.zip'):
            # Extract ZIP
            import io
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
                zf.extractall(game_dir)
        elif filename.endswith('.tar.gz') or filename.endswith('.tgz'):
            import io
            with tarfile.open(fileobj=io.BytesIO(file_bytes), mode='r:gz') as tf:
                tf.extractall(game_dir)
        elif filename.endswith('.tar'):
            import io
            with tarfile.open(fileobj=io.BytesIO(file_bytes), mode='r:') as tf:
                tf.extractall(game_dir)
        else:
            return None, [], f'不支持的文件格式: {filename}（支持 .zip / .tar.gz / .tgz）'
    except Exception as e:
        # Clean up failed extraction
        if os.path.exists(game_dir):
            shutil.rmtree(game_dir)
        return None, [], f'解压失败: {str(e)}'

    # Scan for entry point
    entry_path = None
    file_list = []

    for root, dirs, files in os.walk(game_dir):
        for fname in files:
            rel = os.path.relpath(os.path.join(root, fname), game_dir).replace('\\', '/')
            file_list.append(rel)
            if fname.lower() in [c.lower() for c in ENTRY_CANDIDATES] and entry_path is None:
                entry_path = rel
            # Also try if the first-found candidate is deeper — prefer root-level
            if fname.lower() == 'index.html' and entry_path != 'index.html':
                # Prefer the shallowest index.html
                if entry_path is None or len(rel.split('/')) < len(entry_path.split('/')):
                    entry_path = rel

    if not entry_path:
        # Fallback: find any .html file
        for fname in file_list:
            if fname.endswith('.html') or fname.endswith('.htm'):
                entry_path = fname
                break

    if entry_path:
        return f'games/{slug}/{entry_path}', file_list, None

    return None, file_list, '未找到HTML入口文件，请确保游戏包中包含 index.html 或类似入口文件'


def delete_game_files(slug):
    """Remove extracted game directory for a given slug."""
    game_dir = os.path.join(GAMES_DIR, slug)
    if os.path.exists(game_dir):
        try:
            shutil.rmtree(game_dir)
        except PermissionError:
            # Windows file locking - try once more after a short delay
            import time
            time.sleep(0.3)
            try:
                shutil.rmtree(game_dir)
            except PermissionError:
                pass  # File in use, skip deletion


@games_bp.route('/api/games', methods=['GET'])
@require_admin
def list_games():
    """List games with optional filtering and pagination."""
    category = request.args.get('category', '')
    status = request.args.get('status', '')
    search = request.args.get('search', '')
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 12, type=int)
    offset = (page - 1) * limit

    db = get_db()
    conditions = []
    params = []

    if category:
        conditions.append("c.slug = ?")
        params.append(category)
    if status:
        conditions.append("g.status = ?")
        params.append(status)
    if search:
        conditions.append("(g.title LIKE ? OR g.description LIKE ?)")
        search_term = f"%{search}%"
        params.extend([search_term, search_term])

    where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

    total = db.execute(f"""
        SELECT COUNT(*) FROM games g
        LEFT JOIN categories c ON g.category_id = c.id
        {where_clause}
    """, params).fetchone()[0]

    games = db.execute(f"""
        SELECT g.*, c.name as category_name, c.slug as category_slug, c.icon as category_icon
        FROM games g
        LEFT JOIN categories c ON g.category_id = c.id
        {where_clause}
        ORDER BY g.is_featured DESC, g.sort_order ASC, g.updated_at DESC
        LIMIT ? OFFSET ?
    """, params + [limit, offset]).fetchall()
    db.close()

    return jsonify({
        'games': [dict(row) for row in games],
        'total': total,
        'page': page,
        'limit': limit,
        'total_pages': max(1, (total + limit - 1) // limit),
    })


@games_bp.route('/api/games/<slug>', methods=['GET'])
@require_admin
def get_game(slug):
    """Get a single game by slug."""
    db = get_db()
    game = db.execute("""
        SELECT g.*, c.name as category_name, c.slug as category_slug
        FROM games g
        LEFT JOIN categories c ON g.category_id = c.id
        WHERE g.slug = ?
    """, (slug,)).fetchone()
    db.close()
    if not game:
        return jsonify({'error': '游戏不存在'}), 404
    return jsonify(dict(game))


@games_bp.route('/api/games', methods=['POST'])
@require_admin
def create_game():
    """Create a new game. Supports JSON, multipart form, and zip package import."""
    title = ''
    description = ''
    url = ''
    category_id = ''
    slug = ''
    status = 'draft'
    is_featured = False
    sort_order = 0
    icon_path = None
    is_local = False

    if request.content_type and 'multipart' in request.content_type:
        title = request.form.get('title', '').strip()
        description = request.form.get('description', '')
        url = request.form.get('url', '').strip()
        category_id = request.form.get('category_id', '')
        slug = request.form.get('slug', '').strip()
        status = request.form.get('status', 'draft')
        is_featured = request.form.get('is_featured', '0') in ('1', 'true', 'True')
        sort_order = request.form.get('sort_order', 0, type=int)

        if 'icon' in request.files and request.files['icon'].filename:
            icon_path = save_icon(request.files['icon'])

        # Handle game package upload
        if 'package' in request.files and request.files['package'].filename:
            pkg_file = request.files['package']
            if not slug:
                slug = slugify(title)
            if not slug:
                return jsonify({'error': '无法生成游戏标识'}), 400

            entry, file_list, error = extract_game_package(pkg_file, slug)
            if error:
                return jsonify({'error': error}), 400
            if entry:
                url = entry
                is_local = True
            else:
                return jsonify({'error': '无法识别的游戏包：未找到入口文件', 'files': file_list[:20]}), 400
    else:
        data = request.get_json()
        if not data:
            return jsonify({'error': '请提供游戏信息'}), 400
        title = data.get('title', '').strip()
        description = data.get('description', '')
        url = data.get('url', '').strip()
        category_id = data.get('category_id', '')
        slug = data.get('slug', '').strip()
        status = data.get('status', 'draft')
        is_featured = data.get('is_featured', False)
        sort_order = data.get('sort_order', 0)

    if not title:
        return jsonify({'error': '游戏标题不能为空'}), 400
    if not url:
        return jsonify({'error': '请提供游戏URL或上传游戏包'}), 400
    if not slug:
        slug = slugify(title)
    if not category_id:
        category_id = None

    db = get_db()
    existing = db.execute("SELECT id FROM games WHERE slug = ?", (slug,)).fetchone()
    if existing:
        db.close()
        return jsonify({'error': '游戏标识已存在'}), 409

    cursor = db.execute(
        """INSERT INTO games (title, slug, description, icon_path, url, category_id,
           status, is_featured, sort_order, is_local)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (title, slug, description, icon_path, url, category_id, status,
         1 if is_featured else 0, sort_order, 1 if is_local else 0)
    )
    db.commit()

    new_game = db.execute("""
        SELECT g.*, c.name as category_name, c.slug as category_slug
        FROM games g
        LEFT JOIN categories c ON g.category_id = c.id
        WHERE g.id = ?
    """, (cursor.lastrowid,)).fetchone()
    db.close()

    return jsonify(dict(new_game)), 201


@games_bp.route('/api/games/<slug>', methods=['PUT'])
@require_admin
def update_game(slug):
    """Update an existing game. Supports JSON, multipart form, and zip package update."""
    db = get_db()
    game = db.execute("SELECT * FROM games WHERE slug = ?", (slug,)).fetchone()
    if not game:
        db.close()
        return jsonify({'error': '游戏不存在'}), 404

    title = game['title']
    description = game['description']
    url = game['url']
    category_id = game['category_id']
    new_slug = game['slug']
    status = game['status']
    is_featured = game['is_featured']
    sort_order = game['sort_order']
    icon_path = game['icon_path']
    is_local = game['is_local'] if 'is_local' in game.keys() else 0

    if request.content_type and 'multipart' in request.content_type:
        title = request.form.get('title', game['title']).strip()
        description = request.form.get('description', game['description'])
        url = request.form.get('url', game['url']).strip()
        category_id = request.form.get('category_id', '')
        new_slug = request.form.get('slug', game['slug']).strip()
        status = request.form.get('status', game['status'])
        is_featured = request.form.get('is_featured', str(game['is_featured']))
        sort_order = request.form.get('sort_order', game['sort_order'], type=int)

        if 'icon' in request.files and request.files['icon'].filename:
            icon_path = save_icon(request.files['icon'])

        # Handle game package upload
        if 'package' in request.files and request.files['package'].filename:
            pkg_file = request.files['package']
            use_slug = new_slug if new_slug else slug
            if not use_slug:
                use_slug = slugify(title)
            if not use_slug:
                db.close()
                return jsonify({'error': '无法生成游戏标识'}), 400

            entry, file_list, error = extract_game_package(pkg_file, use_slug)
            if error:
                db.close()
                return jsonify({'error': error}), 400
            if entry:
                url = entry
                is_local = True
            else:
                db.close()
                return jsonify({'error': '无法识别的游戏包', 'files': file_list[:20]}), 400
    else:
        data = request.get_json()
        if not data:
            return jsonify({'error': '请提供更新信息'}), 400
        title = data.get('title', game['title']).strip()
        description = data.get('description', game['description'])
        url = data.get('url', game['url']).strip()
        category_id = data.get('category_id', '')
        new_slug = data.get('slug', game['slug']).strip()
        status = data.get('status', game['status'])
        is_featured = data.get('is_featured', game['is_featured'])
        sort_order = data.get('sort_order', game['sort_order'])

    if not title:
        db.close()
        return jsonify({'error': '游戏标题不能为空'}), 400
    if isinstance(is_featured, bool):
        is_featured = 1 if is_featured else 0
    elif isinstance(is_featured, str):
        is_featured = 1 if is_featured in ('1', 'true', 'True') else 0
    if not new_slug:
        new_slug = slugify(title)
    if not category_id:
        category_id = None

    conflict = db.execute(
        "SELECT id FROM games WHERE slug = ? AND id != ?", (new_slug, game['id'])
    ).fetchone()
    if conflict:
        db.close()
        return jsonify({'error': '游戏标识已被使用'}), 409

    db.execute(
        """UPDATE games SET title=?, slug=?, description=?, icon_path=?, url=?,
           category_id=?, status=?, is_featured=?, sort_order=?, is_local=?,
           updated_at=CURRENT_TIMESTAMP
           WHERE id=?""",
        (title, new_slug, description, icon_path, url, category_id, status,
         is_featured, sort_order, 1 if is_local else 0, game['id'])
    )
    db.commit()

    updated = db.execute("""
        SELECT g.*, c.name as category_name, c.slug as category_slug
        FROM games g
        LEFT JOIN categories c ON g.category_id = c.id
        WHERE g.id = ?
    """, (game['id'],)).fetchone()
    db.close()

    return jsonify(dict(updated))


@games_bp.route('/api/games/<slug>', methods=['DELETE'])
@require_admin
def delete_game(slug):
    """Delete a game, its icon, and its extracted files."""
    db = get_db()
    game = db.execute("SELECT * FROM games WHERE slug = ?", (slug,)).fetchone()
    if not game:
        db.close()
        return jsonify({'error': '游戏不存在'}), 404

    if game['icon_path']:
        icon_full = os.path.join(UPLOADS_DIR, game['icon_path'])
        if os.path.exists(icon_full):
            os.remove(icon_full)

    # Remove extracted game directory
    delete_game_files(slug)

    db.execute("DELETE FROM games WHERE id = ?", (game['id'],))
    db.commit()
    db.close()
    return jsonify({'message': '游戏已删除'})


@games_bp.route('/api/games/<slug>/icon', methods=['POST'])
@require_admin
def upload_game_icon(slug):
    """Upload or update a game's icon."""
    db = get_db()
    game = db.execute("SELECT * FROM games WHERE slug = ?", (slug,)).fetchone()
    if not game:
        db.close()
        return jsonify({'error': '游戏不存在'}), 404
    if 'icon' not in request.files or not request.files['icon'].filename:
        db.close()
        return jsonify({'error': '请上传图标文件'}), 400
    if game['icon_path']:
        old_path = os.path.join(UPLOADS_DIR, game['icon_path'])
        if os.path.exists(old_path):
            os.remove(old_path)
    icon_path = save_icon(request.files['icon'])
    db.execute(
        "UPDATE games SET icon_path=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (icon_path, game['id'])
    )
    db.commit()
    db.close()
    return jsonify({'icon_path': icon_path})


@games_bp.route('/api/games/<slug>/play', methods=['GET'])
@require_admin
def play_game(slug):
    """Get the playable URL for a game (local or remote)."""
    db = get_db()
    game = db.execute("SELECT * FROM games WHERE slug = ?", (slug,)).fetchone()
    db.close()
    if not game:
        return jsonify({'error': '游戏不存在'}), 404
    return jsonify({
        'url': game['url'],
        'is_local': bool(game['is_local']) if 'is_local' in game.keys() else False,
        'title': game['title'],
    })


@games_bp.route('/api/games/import', methods=['POST'])
@require_admin
def import_games():
    """Import games from JSON data."""
    data = request.get_json()
    if not data or 'games' not in data:
        return jsonify({'error': '请提供游戏数据 (games 数组)'}), 400

    db = get_db()
    imported = 0
    errors = []
    for item in data['games']:
        title = item.get('title', '').strip()
        url = item.get('url', '').strip()
        if not title:
            errors.append('缺少标题的游戏被跳过')
            continue
        if not url:
            errors.append(f'"{title}" 缺少URL被跳过')
            continue
        slug = item.get('slug', '').strip() or slugify(title)
        existing = db.execute("SELECT id FROM games WHERE slug = ?", (slug,)).fetchone()
        if existing:
            slug = f"{slug}-{uuid.uuid4().hex[:6]}"
        try:
            db.execute(
                """INSERT INTO games (title, slug, description, url, category_id, status)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (title, slug, item.get('description', ''), url,
                 item.get('category_id'), item.get('status', 'draft'))
            )
            imported += 1
        except Exception as e:
            errors.append(f'导入 "{title}" 失败: {str(e)}')
    db.commit()
    db.close()
    return jsonify({'imported': imported, 'errors': errors, 'message': f'成功导入 {imported} 个游戏'})


@games_bp.route('/api/games/export', methods=['GET'])
@require_admin
def export_games():
    """Export all games as JSON."""
    db = get_db()
    games = db.execute("SELECT * FROM games ORDER BY title ASC").fetchall()
    db.close()
    import datetime
    return jsonify({
        'games': [dict(row) for row in games],
        'exported_at': datetime.datetime.utcnow().isoformat(),
    })


@games_bp.route('/games/<slug>/<path:filename>')
def serve_game_file(slug, filename):
    """Serve extracted game files."""
    game_dir = os.path.join(GAMES_DIR, slug)
    file_path = os.path.join(game_dir, filename)

    # Security: prevent path traversal
    real_path = os.path.realpath(file_path)
    real_game_dir = os.path.realpath(game_dir)
    if not real_path.startswith(real_game_dir):
        return jsonify({'error': '禁止访问'}), 403

    if not os.path.exists(file_path):
        return jsonify({'error': '文件不存在'}), 404

    return send_from_directory(game_dir, filename)


@games_bp.route('/api/games/<slug>/files', methods=['GET'])
@require_admin
def list_game_files(slug):
    """List all files in an imported game package."""
    game_dir = os.path.join(GAMES_DIR, slug)
    if not os.path.exists(game_dir):
        return jsonify({'files': [], 'message': '游戏包目录不存在'})
    files = []
    for root, dirs, fnames in os.walk(game_dir):
        for fname in fnames:
            rel = os.path.relpath(os.path.join(root, fname), game_dir).replace('\\', '/')
            size = os.path.getsize(os.path.join(root, fname))
            files.append({'name': rel, 'size': size})
    return jsonify({'files': files, 'total': len(files)})

"""
Dashboard statistics API route.
"""

from flask import Blueprint, jsonify
from auth import require_admin
from database import get_db

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/api/dashboard/stats', methods=['GET'])
@require_admin
def get_stats():
    """Get dashboard statistics."""
    db = get_db()

    total_games = db.execute("SELECT COUNT(*) FROM games").fetchone()[0]
    published = db.execute("SELECT COUNT(*) FROM games WHERE status = 'published'").fetchone()[0]
    draft = db.execute("SELECT COUNT(*) FROM games WHERE status = 'draft'").fetchone()[0]
    archived = db.execute("SELECT COUNT(*) FROM games WHERE status = 'archived'").fetchone()[0]
    total_categories = db.execute("SELECT COUNT(*) FROM categories").fetchone()[0]
    total_plays = db.execute("SELECT COALESCE(SUM(play_count), 0) FROM games").fetchone()[0]

    # Recent plays
    recent_plays = db.execute("""
        SELECT g.title, g.slug, g.icon_path, pr.played_at, pr.duration
        FROM play_records pr
        JOIN games g ON g.id = pr.game_id
        ORDER BY pr.played_at DESC
        LIMIT 10
    """).fetchall()

    # Top played games
    top_games = db.execute("""
        SELECT title, slug, icon_path, play_count, category_id
        FROM games
        WHERE play_count > 0
        ORDER BY play_count DESC
        LIMIT 5
    """).fetchall()

    # Recent games
    recent_games = db.execute("""
        SELECT g.*, c.name as category_name
        FROM games g
        LEFT JOIN categories c ON g.category_id = c.id
        ORDER BY g.created_at DESC
        LIMIT 5
    """).fetchall()

    # Stats by category
    cat_stats = db.execute("""
        SELECT c.name, c.slug, c.icon, COUNT(g.id) as count
        FROM categories c
        LEFT JOIN games g ON g.category_id = c.id
        GROUP BY c.id
        ORDER BY count DESC
    """).fetchall()

    db.close()

    return jsonify({
        'total_games': total_games,
        'published': published,
        'draft': draft,
        'archived': archived,
        'total_categories': total_categories,
        'total_plays': total_plays,
        'recent_plays': [dict(row) for row in recent_plays],
        'top_games': [dict(row) for row in top_games],
        'recent_games': [dict(row) for row in recent_games],
        'category_stats': [dict(row) for row in cat_stats],
    })

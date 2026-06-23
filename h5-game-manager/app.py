"""
Flask API application factory.
"""
from flask import Flask
from flask_cors import CORS
import os


def create_app():
    app = Flask(__name__)
    CORS(app)

    from auth import auth_bp
    from routes.categories import categories_bp
    from routes.games import games_bp
    from routes.users import users_bp
    from routes.dashboard import dashboard_bp
    from routes.public import public_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(games_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(public_bp)

    # Serve uploaded files
    UPLOADS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')

    @app.route('/uploads/<path:filename>')
    def uploaded_file(filename):
        from flask import send_from_directory
        return send_from_directory(UPLOADS, filename)

    from flask import jsonify

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'error': 'Not found'}), 404

    return app

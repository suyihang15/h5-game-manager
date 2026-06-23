"""
H5 Game Manager - Desktop App
Single server, opens browser. Double-click to run.
"""
import sys, os, threading, webbrowser, time, socket

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from database import init_db
from flask import Flask, send_from_directory

PORT = 5788
WEB = os.path.join(BASE_DIR, 'web')


def port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0


def make_app():
    app = Flask(__name__)

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

    @app.route('/uploads/<path:filename>')
    def uploads(filename):
        return send_from_directory(os.path.join(BASE_DIR, 'uploads'), filename)

    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def web(path):
        fp = os.path.join(WEB, path)
        if path and os.path.exists(fp) and os.path.isfile(fp):
            return send_from_directory(WEB, path)
        return send_from_directory(WEB, 'index.html')

    return app


def main():
    print('=' * 50)
    print('  H5 Game Manager v1.0')
    print('  http://127.0.0.1:%d' % PORT)
    print('=' * 50)

    # Check port
    if port_in_use(PORT):
        print('[ERROR] Port %d is already in use!' % PORT)
        print('Please close the other program using port %d, or restart your computer.' % PORT)
        print('You can also run: netstat -ano | findstr :%d' % PORT)
        input('Press Enter to exit...')
        sys.exit(1)

    # Init DB
    try:
        init_db()
        print('[OK] Database ready')
    except Exception as e:
        print('[ERROR] Database init failed: %s' % e)
        input('Press Enter to exit...')
        sys.exit(1)

    # Start server
    app = make_app()
    url = 'http://127.0.0.1:%d' % PORT

    print('[OK] Starting server...')

    def run():
        try:
            app.run(host='127.0.0.1', port=PORT, debug=False, threaded=True)
        except Exception as e:
            print('[ERROR] Server failed: %s' % e)

    threading.Thread(target=run, daemon=True).start()

    # Wait for server to be ready
    print('[OK] Waiting for server...')
    for i in range(20):
        time.sleep(0.3)
        if port_in_use(PORT):
            print('[OK] Server ready at %s' % url)
            break
    else:
        print('[ERROR] Server failed to start on port %d' % PORT)
        input('Press Enter to exit...')
        sys.exit(1)

    print('[OK] Opening browser...')
    print('[OK] Login: admin / admin123')
    print()
    print('Keep this window open while using the app.')
    print('Press Ctrl+C to stop the server.')
    print()

    webbrowser.open(url)

    # Keep running
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print('\nShutting down...')


if __name__ == '__main__':
    main()

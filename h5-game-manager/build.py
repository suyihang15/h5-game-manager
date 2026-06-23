"""
Build H5GameManager.exe with PyInstaller.
Usage: python build.py
"""
import os, sys, subprocess, shutil

BASE = os.path.dirname(os.path.abspath(__file__))
SEP = ';'


def build():
    print("Installing PyInstaller...")
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'pyinstaller'])

    print("Building EXE...")
    cmd = [
        sys.executable, '-m', 'PyInstaller',
        '--noconfirm', '--onefile', '--windowed',
        '--name', 'H5GameManager',
        '--add-data', 'web' + SEP + 'web',
        '--add-data', 'requirements.txt' + SEP + '.',
        '--hidden-import', 'flask',
        '--hidden-import', 'flask_cors',
        '--hidden-import', 'jwt',
        '--hidden-import', 'bcrypt',
        '--hidden-import', 'slugify',
        '--hidden-import', 'PIL',
        os.path.join(BASE, 'main.py'),
    ]
    subprocess.check_call(cmd)

    exe = os.path.join(BASE, 'dist', 'H5GameManager.exe')
    if os.path.exists(exe):
        size_mb = os.path.getsize(exe) / (1024 * 1024)
        print('\nBuild successful: %s (%.1f MB)' % (exe, size_mb))
    else:
        print('\nBuild may have failed, check errors above.')


def clean():
    for d in ['build', 'dist']:
        p = os.path.join(BASE, d)
        if os.path.exists(p):
            shutil.rmtree(p)
    for f in os.listdir(BASE):
        if f.endswith('.spec'):
            os.remove(os.path.join(BASE, f))


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'clean':
        clean()
    else:
        build()

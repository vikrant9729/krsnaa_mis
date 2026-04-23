import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

SKIP_DIRS = {'.git', '__pycache__', 'node_modules', 'venv', '.venv'}
SKIP_EXTS = {'.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.eot', '.ttf', '.mp4', '.pdf'}

def is_text_file(path):
    _, ext = os.path.splitext(path)
    if ext.lower() in SKIP_EXTS:
        return False
    return True

def scan(root):
    bad_files = []
    for dirpath, dirnames, filenames in os.walk(root):
        # mutate dirnames in-place to skip dirs
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            fp = os.path.join(dirpath, fn)
            if not is_text_file(fp):
                continue
            try:
                with open(fp, 'r', encoding='utf-8') as f:
                    f.read()
            except Exception as e:
                # Collect sample of binary data
                try:
                    with open(fp, 'rb') as bf:
                        raw = bf.read(512)
                except Exception:
                    raw = b''
                bad_files.append((fp, str(e), raw))
    return bad_files

def main():
    root = ROOT
    print(f"Scanning files under: {root}")
    bad = scan(root)
    if not bad:
        print("All scanned files are valid UTF-8 text files.")
        return 0

    print(f"Found {len(bad)} files with encoding/read errors:")
    for fp, err, raw in bad:
        print('\n' + '-'*80)
        print(f"FILE: {fp}")
        print(f"ERROR: {err}")
        if raw:
            # show bytes as hex and try to show a utf-8-safe repr
            hexs = ' '.join(f"{b:02x}" for b in raw[:64])
            safe = raw.decode('utf-8', errors='replace')
            print(f"RAW-HEX (first 64 bytes): {hexs}")
            print(f"RAW-DECODE (replacement): {safe[:200]!r}")

    return 1

if __name__ == '__main__':
    sys.exit(main())

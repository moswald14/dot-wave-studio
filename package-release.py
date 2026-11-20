"""Build a reproducible offline download from an explicit source allowlist."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent
version = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
parser = argparse.ArgumentParser()
parser.add_argument('--out', type=Path, default=ROOT / 'dist' / f'Dot-Wave-Studio-{version}-download.zip')
args = parser.parse_args()
target = args.out.resolve()
if target.exists():
    raise SystemExit(f'Refusing to overwrite {target}')
files = {}
def add(name, source):
    if name in files:
        raise ValueError(f'Duplicate archive entry: {name}')
    files[name] = source.read_bytes()

for name in [f'Dot-Wave-Studio-{version}.html', 'Dot-Wave-Classic.html', 'Third-party-notices.txt', 'START-HERE.md', 'Capture-guide.md', 'Vocals-guide.md', 'WOOFpad-guide.md', 'Wave-Shaper-guide.md']:
    add(name, ROOT / 'releases' / name if name.startswith('Dot-Wave-Studio-') else ROOT / name)
for folder, destination in [('sample-credits', 'Sample-credits'), ('skills/dot-wave-studio', 'Codex-skill/dot-wave-studio'), ('examples', 'Examples')]:
    for file in sorted((ROOT / folder).rglob('*')):
        if file.is_file():
            add(destination + '/' + file.relative_to(ROOT / folder).as_posix(), file)
for file in sorted(ROOT.iterdir()):
    if file.is_file() and file.suffix in {'.js', '.cjs', '.css', '.html', '.json', '.md', '.py', '.txt'} and file.name not in {'verification.json', 'Dot-Wave-Classic.html'}:
        add('Source/' + file.name, file)
for folder in ['dsp', 'fixtures', 'sample-credits', 'skills', 'reports', 'docs', '.github']:
    for file in sorted((ROOT / folder).rglob('*')):
        if file.is_file():
            add('Source/' + file.relative_to(ROOT).as_posix(), file)
add('Source/Dot-Wave-Classic.html', ROOT / 'Dot-Wave-Classic.html')
if (ROOT / 'LICENSE').is_file():
    add('LICENSE', ROOT / 'LICENSE')
    add('Source/LICENSE', ROOT / 'LICENSE')
manifest = {'version': version, 'files': {name: hashlib.sha256(data).hexdigest() for name, data in sorted(files.items())}}
files['SHA256SUMS.json'] = (json.dumps(manifest, indent=2) + '\n').encode()
target.parent.mkdir(parents=True, exist_ok=True)
with target.open('xb') as raw:
    with zipfile.ZipFile(raw, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for name, data in sorted(files.items()):
            entry = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o644 << 16
            archive.writestr(entry, data, compresslevel=6)
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
    saved = json.loads(archive.read('SHA256SUMS.json'))
    assert set(archive.namelist()) == set(saved['files']) | {'SHA256SUMS.json'}
    for name, expected in saved['files'].items():
        assert hashlib.sha256(archive.read(name)).hexdigest() == expected
print(json.dumps({'path': str(target), 'version': version, 'files': len(files), 'bytes': target.stat().st_size, 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}, indent=2))

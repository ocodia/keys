"""Reproduce the bundled samples; no package code is installed or executed."""
import concurrent.futures
import hashlib
import io
import json
from pathlib import Path
import tarfile
import urllib.request

DEST = Path(__file__).resolve().parents[1] / 'sounds' / 'salamander'
DEST.mkdir(parents=True, exist_ok=True)

def download(layer):
    package = f'@audio-samples/piano-velocity{layer}'
    with urllib.request.urlopen(f'https://registry.npmjs.org/{package}/1.0.5') as response:
        metadata = json.load(response)
    with urllib.request.urlopen(metadata['dist']['tarball']) as response:
        data = response.read()
    assert hashlib.sha1(data).hexdigest() == metadata['dist']['shasum']
    files = []
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:gz') as archive:
        for member in archive.getmembers():
            if not member.isfile() or not member.name.startswith('package/audio/') or not member.name.endswith('.ogg'):
                continue
            name = Path(member.name).name
            content = archive.extractfile(member).read()
            assert content[:4] == b'OggS'
            (DEST / name).write_bytes(content)
            files.append({'file': name, 'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()})
    assert len(files) == 30
    return {'package': package, 'version': '1.0.5', 'tarball': metadata['dist']['tarball'], 'files': sorted(files, key=lambda item: item['file'])}

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    manifest = list(pool.map(download, range(1, 17)))
(DEST / 'provenance.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(f"Downloaded {sum(len(p['files']) for p in manifest)} samples, {sum(f['bytes'] for p in manifest for f in p['files']) / 1048576:.1f} MiB")

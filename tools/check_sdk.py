"""Verify the SDK download snapshot and code examples without contacting devices."""
import ast
import hashlib
import io
import json
from pathlib import Path
import re
import zipfile
from sync_sdk import SDK_FILES

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / 'source/_downloads/sdk-provenance.json').read_text(encoding='utf-8'))
archive = ROOT / 'source/_downloads' / manifest['archive']
data = archive.read_bytes()
assert hashlib.sha256(data).hexdigest() == manifest['sha256']
assert manifest['sha256'] in archive.with_suffix('.sha256').read_text()
with zipfile.ZipFile(io.BytesIO(data)) as package:
    assert package.testzip() is None
    assert set(package.namelist()) == set(manifest['files'])
    assert {name for name in package.namelist() if name.startswith('SDK/')} == {'SDK/' + name for name in SDK_FILES}
    for name, checksum in manifest['files'].items():
        assert not Path(name).is_absolute() and '..' not in Path(name).parts
        assert name.startswith(('SDK/', 'docs/public_api/'))
        assert not any(part in name for part in ('__pycache__', 'VIO-Neo/', 'drivers/', 'firmware/'))
        raw = package.read(name)
        assert hashlib.sha256(raw).hexdigest() == checksum, name
        assert raw == (ROOT / 'source/_sdk' / name).read_bytes(), name
        if name.endswith('.py'):
            ast.parse(raw.decode('utf-8'), filename=name)
for page in ('sdk', 'sdk-python', 'sdk-cpp', 'sdk-stm32', 'ros', 'ros2'):
    text = (ROOT / 'source' / (page + '.rst')).read_text(encoding='utf-8')
    for line in text.splitlines():
        if line.startswith('.. literalinclude:: '):
            assert (ROOT / 'source' / line.split(':: ', 1)[1]).is_file(), line
assert '尚未提供' not in (ROOT / 'source/ros.rst').read_text(encoding='utf-8')
assert '尚未提供' not in (ROOT / 'source/ros2.rst').read_text(encoding='utf-8')
with zipfile.ZipFile(ROOT / 'site/neo-http-python.zip') as package:
    for name in ('client.py', 'transport.py', 'camera_model.py'):
        assert package.read(name) == (ROOT / 'source/_sdk/SDK/python/robobaton_sdk' / name).read_bytes()
    assert b'runpy.run_path' not in package.read('client.py')
code = (ROOT / 'site/neo_quick_test.py').read_text(encoding='utf-8')
assert code == (ROOT / 'source/_static/neo_quick_test.py').read_text(encoding='utf-8')
assert code == json.loads((ROOT / 'site/integration-examples.json').read_text(encoding='utf-8'))['quick_test']
ast.parse(code)
print('PASS: %d SDK/API file hashes, archive isolation, literalinclude sources, legacy ZIP and single-file parity' % len(manifest['files']))

"""RBR1 read-only inspector. Accepts a directory or a single segment, not a tar.

CRC establishes a complete prefix, not cryptographic authenticity. No file is
modified. Interrupted tails remain available for diagnosis.
"""
import argparse
import json
from pathlib import Path
import re
import struct
import zlib

CHANNELS = {5: 'gray', 3: 'imu', 4: 'color', 2: 'odometry'}
META_MAX = 8192
PAYLOAD_MAX = 2 * 1024 * 1024


def _json(raw):
    def unique(pairs):
        result = {}
        for k, v in pairs:
            if k in result:
                raise ValueError('duplicate JSON key')
            result[k] = v
        return result
    value = json.loads(raw, object_pairs_hook=unique,
                       parse_constant=lambda _: (_ for _ in ()).throw(ValueError('nonfinite JSON')))
    if not isinstance(value, dict):
        raise ValueError('expected JSON object')
    return value


def records(file, expected_id=None, expected_segment=None):
    """Yield header then validated records; raise on any truncated/damaged tail.

    A caller may preserve earlier yielded records as a recoverable prefix. The
    binary payload never passes through text, JSON numbers or a C memory layout.
    """
    h = file.read(64)
    if len(h) != 64 or h[:4] != b'RBR1' or struct.unpack_from('<HH', h, 4) != (1, 64):
        raise ValueError('invalid segment header')
    number, length = struct.unpack_from('<II', h, 8)
    identifier = h[16:48].decode('ascii')
    if not re.fullmatch('[0-9a-f]{32}', identifier) or not number or any(h[48:60]):
        raise ValueError('invalid identity/reserved fields')
    if expected_id is not None and identifier != expected_id:
        raise ValueError('recording identity mismatch')
    if expected_segment is not None and number != expected_segment:
        raise ValueError('segment sequence mismatch')
    if not 1 <= length <= META_MAX:
        raise ValueError('invalid config length')
    raw = file.read(length)
    if len(raw) != length or zlib.crc32(raw, zlib.crc32(h[:60])) != struct.unpack_from('<I', h, 60)[0]:
        raise ValueError('invalid config CRC')
    config = _json(raw)
    if config.get('recording_id') != identifier or config.get('format') != 'RBR1':
        raise ValueError('config identity mismatch')
    yield {'type': 'config', 'config': config, 'valid_bytes': 64 + length}
    offset = 64 + length
    ended = False
    while True:
        h = file.read(16)
        if not h:
            if not ended:
                raise ValueError('segment has no end record')
            return
        if len(h) != 16 or ended:
            raise ValueError('trailing or incomplete record header')
        kind, channel, ml, pl, crc = struct.unpack('<HHIII', h)
        if kind not in (1, 2, 3) or not 1 <= ml <= META_MAX or pl > PAYLOAD_MAX:
            raise ValueError('record length/type out of range')
        if (kind == 1 and channel not in CHANNELS) or (kind != 1 and (channel or pl)):
            raise ValueError('invalid channel/payload')
        raw, payload = file.read(ml), file.read(pl)
        if len(raw) != ml or len(payload) != pl or zlib.crc32(payload, zlib.crc32(raw, zlib.crc32(h[:12]))) != crc:
            raise ValueError('incomplete/corrupt record')
        meta = _json(raw)
        offset += 16 + ml + pl
        ended = kind == 3
        yield {'type': ('data', 'event', 'end')[kind - 1], 'channel': CHANNELS.get(channel),
               'metadata': meta, 'payload': payload, 'valid_bytes': offset}


def inspect(path):
    path = Path(path)
    paths = sorted(path.glob('segments/*.rbr*')) if path.is_dir() else [path]
    counts = dict.fromkeys(CHANNELS.values(), 0)
    output = {'counts': counts, 'valid_bytes': 0, 'segments': [], 'complete': False}
    identifier = path.name if path.is_dir() else None
    expected = 1 if path.is_dir() else None
    for p in paths:
        result = {'file': p.name, 'valid_bytes': 0, 'ended': False}
        output['segments'].append(result)
        try:
            with p.open('rb') as f:
                for row in records(f, identifier, expected):
                    result['valid_bytes'] = row['valid_bytes']
                    if row['type'] == 'data':
                        counts[row['channel']] += 1
                    if row['type'] == 'end':
                        result['ended'] = True
        except (ValueError, UnicodeError, OSError) as e:
            result['error'] = str(e)
        output['valid_bytes'] += result['valid_bytes']
        if 'error' in result:
            break
        if expected is not None:
            expected += 1
    output['structurally_closed'] = bool(paths) and all(s['ended'] and 'error' not in s for s in output['segments'])
    if path.is_dir():
        try:
            final = _json((path / 'result.json').read_bytes())
            output['result'] = final
            output['complete'] = output['structurally_closed'] and final.get('complete') is True and final.get('recording_id') == identifier and all(str(counts[k]) == final['counts'][k] for k in counts) and (path / 'mono.conf').is_file()
        except (ValueError, OSError, KeyError):
            output['result'] = None
    return output


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('path')
    args = parser.parse_args()
    print(json.dumps(inspect(args.path), indent=2, ensure_ascii=False))

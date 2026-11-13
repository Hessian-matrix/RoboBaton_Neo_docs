import argparse
import json
from pathlib import Path

from robobaton_sdk import Device


def main():
    parser = argparse.ArgumentParser(description='Save public gray JPEG frames and source metadata')
    parser.add_argument('origin')
    parser.add_argument('directory', type=Path)
    parser.add_argument('--messages', type=int, default=10)
    args = parser.parse_args()
    if args.messages < 1 or not args.directory.is_dir():
        parser.error('Use a positive message count and an existing output directory')
    stream = Device(args.origin).observe(['gray_jpeg'])
    received = 0
    try:
        for name, fmt, sequence, sample in stream:
            if name != 'gray_jpeg':
                continue
            path = args.directory / (str(sequence) + '.jpg')
            sidecar = args.directory / (str(sequence) + '.json')
            if path.exists() or sidecar.exists():
                raise FileExistsError('Use a fresh output directory')
            with path.open('xb') as output:
                output.write(sample['data'])
            metadata = {key: value for key, value in sample.items() if key != 'data'}
            with sidecar.open('x', encoding='utf-8') as output:
                json.dump(metadata, output, separators=(',', ':'))
            print(path)
            received += 1
            if received >= args.messages:
                return
        raise ConnectionError('Image stream ended before requested frame count')
    finally:
        stream.close()


if __name__ == '__main__':
    main()

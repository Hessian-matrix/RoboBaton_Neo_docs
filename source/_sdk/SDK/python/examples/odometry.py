import argparse
import json

from robobaton_sdk import Device


def main():
    parser = argparse.ArgumentParser(description='只读订阅 Neo HTTP 数据')
    parser.add_argument('origin', nargs='?', default='http://192.168.11.1')
    parser.add_argument('--channel', choices=['odometry', 'imu'], default='odometry')
    parser.add_argument('--messages', type=int, default=10)
    args = parser.parse_args()
    if args.messages < 1:
        parser.error('--messages 必须大于 0')
    stream = Device(args.origin).observe([args.channel])
    remaining = args.messages
    try:
        for name, fmt, sequence, message in stream:
            if name == 'control':
                continue
            print(json.dumps(message, ensure_ascii=False))
            remaining -= 1
            if remaining == 0:
                break
        if remaining:
            raise ConnectionError('数据流提前结束，请检查设备后重新建立会话')
    finally:
        stream.close()


if __name__ == '__main__':
    main()

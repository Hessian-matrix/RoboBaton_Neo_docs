import copy
import importlib.util
import io
import json
import os
import queue
from pathlib import Path
import struct
import subprocess
import sys
import threading
import tempfile
import types
import unittest
import re
import ast
from urllib.parse import unquote
import xml.etree.ElementTree as ET
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = Path(__file__).resolve().parents[2]
sys.dont_write_bytecode = True
sys.path.insert(0, str(ROOT / 'SDK/python'))
from robobaton_sdk import Device
from robobaton_sdk.transport import records
from robobaton_sdk.ros_adapter import convert, convert_image, source_header, Samples

SAMPLE = {
    'header': {'seq': '9007199254740993', 'stamp': {'sec': 12, 'nanosec': 345}},
    'pose': {'position': {'x': 1.0, 'y': 2.0, 'z': 3.0},
             'orientation': {'x': 0.0, 'y': 0.0, 'z': 0.0, 'w': 1.0}},
    'twist': {'linear': {'x': 4.0, 'y': 5.0, 'z': 6.0},
              'angular': {'x': 0.1, 'y': 0.2, 'z': 0.3}},
    'confidence': None, 'trip_distance_m': None,
}
METADATA = {'type': 'metadata', 'stream': {'source': {'type': 'live'},
            'channels': [{'id': 2, 'name': 'odometry', 'format': 1}]}}


def frame(channel, sequence, payload, total=None, offset=0, flags=3, fmt=1):
    return struct.pack('<4sHHHHIQIIII', b'RBH1', 1, 40, channel, fmt, flags, sequence,
                       len(payload) if total is None else total, offset, len(payload), 0) + payload


def wire(metadata=None, sample=None):
    metadata = METADATA if metadata is None else metadata
    sample = SAMPLE if sample is None else sample
    return frame(0, 1, json.dumps(metadata).encode()) + frame(2, 1, json.dumps(sample).encode())


class HttpServer:
    def __init__(self, payload, content_type='application/vnd.robobaton.stream', status=200):
        self.payload = payload
        self.paths = []
        owner = self

        class Handler(BaseHTTPRequestHandler):
            protocol_version = 'HTTP/1.1'

            def do_GET(self):
                owner.paths.append(self.path)
                self.send_response(status)
                self.send_header('Content-Type', content_type)
                self.send_header('Transfer-Encoding', 'chunked')
                self.send_header('Connection', 'close')
                self.close_connection = True
                self.end_headers()
                try:
                    for offset in range(0, len(owner.payload), 7):
                        chunk = owner.payload[offset:offset+7]
                        self.wfile.write(('%x\r\n' % len(chunk)).encode() + chunk + b'\r\n')
                    self.wfile.write(b'0\r\n\r\n')
                    self.wfile.flush()
                except (BrokenPipeError, ConnectionResetError):
                    pass

            def log_message(self, *args):
                pass

        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.server.daemon_threads = True
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.origin = 'http://127.0.0.1:%d' % self.server.server_port

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *args):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()


def object_message():
    def node(**kwargs):
        return types.SimpleNamespace(**kwargs)
    return node(header=node(), child_frame_id='',
                pose=node(pose=node(position=node(), orientation=node()), covariance=[]),
                twist=node(twist=node(linear=node(), angular=node()), covariance=[]))


class SDKTest(unittest.TestCase):
    def test_public_contract_links_and_package_syntax(self):
        document = json.loads((ROOT / 'docs/public_api/http-api.openapi.json').read_text(encoding='utf-8'))
        def references(node):
            if isinstance(node, dict):
                for key, value in node.items():
                    if key == '$ref' and value.startswith('#/'):
                        target = document
                        for part in value[2:].split('/'):
                            target = target[part.replace('~1', '/').replace('~0', '~')]
                    else:
                        references(value)
            elif isinstance(node, list):
                for value in node:
                    references(value)
        references(document)
        for path in (ROOT / 'SDK').rglob('*.md'):
            for link in re.findall(r'\]\(([^)]+)\)', path.read_text(encoding='utf-8')):
                if '://' not in link and not link.startswith('#'):
                    self.assertTrue((path.parent / unquote(link.split('#')[0])).exists(), (path, link))
        for path in (ROOT / 'SDK').rglob('*.py'):
            ast.parse(path.read_text(encoding='utf-8'), filename=str(path))
        for path in (ROOT / 'SDK/ros').rglob('package.xml'):
            self.assertEqual(ET.parse(path).getroot().findtext('name'), 'robobaton_neo')

    def test_python_http_chunked(self):
        with HttpServer(wire()) as server:
            stream = Device(server.origin).observe(['odometry'])
            try:
                messages = [value for name, fmt, seq, value in stream if name == 'odometry']
            finally:
                stream.close()
            self.assertEqual(messages, [SAMPLE])
            self.assertEqual(server.paths, ['/api/stream?channels=odometry'])

    def test_python_cli(self):
        with HttpServer(wire()) as server:
            result = subprocess.run([sys.executable, '-B', str(ROOT / 'SDK/python/examples/odometry.py'),
                                     server.origin, '--messages', '1'], capture_output=True, text=True,
                                    env=dict(os.environ, PYTHONPATH=str(ROOT / 'SDK/python')), timeout=10)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout), SAMPLE)

    def test_python_cli_early_eof(self):
        with HttpServer(wire()) as server:
            result = subprocess.run([sys.executable, '-B', str(ROOT / 'SDK/python/examples/odometry.py'),
                                     server.origin, '--messages', '2'], capture_output=True, text=True,
                                    env=dict(os.environ, PYTHONPATH=str(ROOT / 'SDK/python')), timeout=10)
            self.assertNotEqual(result.returncode, 0)

    @unittest.skipUnless((ROOT / 'tools/http-api/client.py').is_file(), 'Application-only legacy compatibility test')
    def test_legacy_paths(self):
        spec = importlib.util.spec_from_file_location('legacy_client', ROOT / 'tools/http-api/client.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertIn('SDK/python/robobaton_sdk', module.Device.observe.__code__.co_filename.replace('\\', '/'))
        self.assertEqual(module.validate_odometry(copy.deepcopy(SAMPLE)), SAMPLE)
        for name in ('transport', 'camera_model'):
            spec = importlib.util.spec_from_file_location('legacy_' + name, ROOT / ('tools/http-api/' + name + '.py'))
            legacy = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(legacy)
            self.assertTrue(hasattr(legacy, 'records' if name == 'transport' else 'Model'))

    def test_fragmented_interleaving(self):
        data = frame(2, 2**53+1, b'ab', 4, 0, 1) + frame(0, 1, b'{}')
        data += frame(2, 2**53+1, b'cd', 4, 2, 2)
        self.assertEqual([(channel, sequence, bytes(payload)) for channel, fmt, sequence, payload
                          in records(io.BytesIO(data))], [(0, 1, b'{}'), (2, 2**53+1, b'abcd')])

    def test_truncated_and_invalid(self):
        valid = frame(2, 1, b'{}')
        for cut in range(1, len(valid)):
            with self.assertRaises(ValueError):
                list(records(io.BytesIO(valid[:cut])))
        for offset in (0, 4, 6, 8, 10, 12, 24, 28, 32, 36):
            damaged = bytearray(valid)
            damaged[offset] = 255
            with self.assertRaises(ValueError):
                list(records(io.BytesIO(damaged)))
        with self.assertRaises(ValueError):
            list(records(io.BytesIO(valid + valid)))
        changed = frame(2, 1, b'a', 3, 0, 1) + frame(2, 1, b'b', 2, 1, 2)
        with self.assertRaises(ValueError):
            list(records(io.BytesIO(changed)))

    def test_python_http_rejection(self):
        wrong = copy.deepcopy(METADATA)
        wrong['stream']['channels'][0]['id'] = 3
        for payload, content_type, status in (
            (wire(metadata=wrong), 'application/vnd.robobaton.stream', 200),
            (wire(), 'application/json', 200),
            (wire(), 'application/vnd.robobaton.stream', 503),
            (wire()[:-1], 'application/vnd.robobaton.stream', 200),
        ):
            with HttpServer(payload, content_type, status) as server:
                with self.assertRaises((ValueError, RuntimeError)):
                    list(Device(server.origin).observe(['odometry']))

    def test_origin_rejection(self):
        for origin in ('ftp://host', 'http://user:pass@host', 'http://host/api', 'http://host?x=1'):
            with self.assertRaises(ValueError):
                Device(origin)

    def test_ros_conversion(self):
        message = convert(SAMPLE, object_message(), 'host_stamp', 'neo_world', 'neo_imu', 1000.0, 2000.0)
        self.assertEqual(message.header.stamp, 'host_stamp')
        self.assertEqual(message.header.frame_id, 'neo_world')
        self.assertEqual(message.child_frame_id, 'neo_imu')
        self.assertEqual(message.pose.pose.position.x, 1.0)
        self.assertEqual(message.pose.pose.orientation.w, 1.0)
        self.assertEqual(message.twist.twist.linear.x, 4.0)
        self.assertEqual(message.twist.twist.angular.z, 0.3)
        self.assertEqual([message.pose.covariance[index] for index in range(0, 36, 7)], [1000.0]*6)
        self.assertEqual(json.loads(source_header(SAMPLE)), SAMPLE['header'])

    def test_ros_invalid(self):
        for key in ('pose', 'twist'):
            sample = copy.deepcopy(SAMPLE)
            sample[key] = None
            self.assertIsNone(convert(sample, object_message(), None, 'world', 'imu', 1.0, 1.0))
        sample = copy.deepcopy(SAMPLE)
        sample['header']['stamp'] = None
        self.assertIsNone(convert(sample, object_message(), None, 'world', 'imu', 1.0, 1.0))
        for variance in (0.0, -1.0, float('nan'), float('inf')):
            with self.assertRaises(ValueError):
                convert(SAMPLE, object_message(), None, 'world', 'imu', variance, 1.0)
        with self.assertRaises(ValueError):
            convert(SAMPLE, object_message(), None, 'imu', 'imu', 1.0, 1.0)

    def test_ros_bounded_worker(self):
        samples = Samples.__new__(Samples)
        samples.items = queue.Queue(maxsize=1)
        for index in range(100):
            samples._put(index)
        self.assertEqual(samples.latest(), 99)
        self.assertIsNone(samples.latest())

    def test_ros_eof_rejected(self):
        with HttpServer(wire()) as server:
            samples = Samples(server.origin)
            samples.thread.join(timeout=5)
            self.assertFalse(samples.thread.is_alive())
            with self.assertRaises(ConnectionError):
                samples.latest()
            samples.close()

    def test_ros_reset_rejected(self):
        payload = wire() + frame(2, 2, json.dumps(SAMPLE).encode())
        with HttpServer(payload) as server:
            samples = Samples(server.origin)
            samples.thread.join(timeout=5)
            with self.assertRaisesRegex(ValueError, 'sequence reset'):
                samples.latest()
            samples.close()

    @unittest.skipUnless((ROOT / 'tools/http-api/build_quick_test.py').is_file(), 'Application-only single-file generator test')
    def test_standalone_generator(self):
        spec = importlib.util.spec_from_file_location('standalone_build', ROOT / 'tools/http-api/build_quick_test.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        namespace = {'__name__': 'sdk_standalone_test'}
        exec(compile(module.build(), '<standalone>', 'exec'), namespace)
        self.assertIn('ReadOnlyDevice', namespace)
        with HttpServer(wire()) as server:
            result = list(namespace['Device'](server.origin).observe(['odometry']))
            self.assertEqual(result[-1][-1], SAMPLE)

    @unittest.skipUnless(os.environ.get('SDK_CPP_EXAMPLE'), 'C++ binary supplied by CTest')
    def test_cpp_http(self):
        binary = os.environ['SDK_CPP_EXAMPLE']
        for payload, content_type, status, succeeds in (
            (wire(), 'application/vnd.robobaton.stream', 200, True),
            (wire()[:-1], 'application/vnd.robobaton.stream', 200, False),
            (wire(), 'application/json', 200, False),
            (wire(), 'application/vnd.robobaton.stream', 503, False),
            (frame(2, 1, json.dumps(SAMPLE).encode()), 'application/vnd.robobaton.stream', 200, False),
            (frame(0, 1, json.dumps(METADATA).encode()), 'application/vnd.robobaton.stream', 200, False),
            (wire() + b'invalid trailing bytes', 'application/vnd.robobaton.stream', 200, True),
        ):
            with HttpServer(payload, content_type, status) as server:
                result = subprocess.run([binary, server.origin, '1'], capture_output=True, text=True, timeout=10)
                self.assertEqual(result.returncode == 0, succeeds, result.stderr)
                if succeeds:
                    self.assertEqual(json.loads(result.stdout), SAMPLE)


class ImageTests(unittest.TestCase):
    config = {'encoding': 'jpeg', 'pixel_format': 'mono8', 'width': 544,
              'height': 640, 'quality': 90, 'frame_rate_mode': 'source'}
    header = {'header': SAMPLE['header'], 'pts_us': None, 'random_access': True}
    jpeg = b'\xff\xd8test-binary\x00\xff\xd9'

    def wire_image(self, config=None, header=None, jpeg=None):
        metadata = {'type': 'metadata', 'stream': {'source': {'type': 'live'},
                    'channels': [{'id': 6, 'name': 'gray_jpeg', 'format': 7}]},
                    'config': self.config if config is None else config}
        raw = json.dumps(self.header if header is None else header).encode()
        payload = struct.pack('<I', len(raw)) + raw + (self.jpeg if jpeg is None else jpeg)
        return frame(0, 1, json.dumps(metadata).encode()) + frame(6, 1, payload, fmt=7)

    def test_image_http_and_ros(self):
        with HttpServer(self.wire_image()) as server:
            values = list(Device(server.origin).observe(['gray_jpeg']))
            self.assertEqual(server.paths, ['/api/stream?channels=gray_jpeg'])
        sample = values[-1][-1]
        self.assertEqual(sample['data'], self.jpeg)
        message = convert_image(sample, types.SimpleNamespace(header=types.SimpleNamespace()),
                                'host_stamp', 'neo_camera_optical')
        self.assertEqual(message.data, self.jpeg)
        self.assertEqual(message.header.stamp, 'host_stamp')
        self.assertEqual(message.header.frame_id, 'neo_camera_optical')
        self.assertEqual(message.format, 'mono8; jpeg compressed mono8')
        self.assertEqual(json.loads(source_header(sample)), self.header['header'])
        with self.assertRaises(ValueError):
            convert_image(sample, message, 'stamp', '')

    def test_image_worker_eof(self):
        with HttpServer(self.wire_image()) as server:
            samples = Samples(server.origin, 'gray_jpeg')
            samples.thread.join(timeout=5)
            with self.assertRaises(ConnectionError):
                samples.latest()
            samples.close()

    def test_python_image_example(self):
        (ROOT / 'tmp').mkdir(exist_ok=True)
        env = dict(os.environ, PYTHONPATH=str(ROOT / 'SDK/python'))
        with tempfile.TemporaryDirectory(dir=ROOT / 'tmp') as directory, HttpServer(self.wire_image()) as server:
            command = [sys.executable, '-B', str(ROOT / 'SDK/python/examples/image.py'),
                       server.origin, directory, '--messages', '1']
            result = subprocess.run(command, env=env, capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual((Path(directory) / '1.jpg').read_bytes(), self.jpeg)
            metadata = json.loads((Path(directory) / '1.json').read_text())
            self.assertEqual(metadata['header'], self.header['header'])
            result = subprocess.run(command, env=env, capture_output=True, text=True, timeout=10)
            self.assertNotEqual(result.returncode, 0)

    def test_jpeg_sequence_gaps(self):
        raw = json.dumps(dict(self.header, header=dict(self.header['header'], seq='9007199254740995'))).encode()
        payload = self.wire_image() + frame(6, 2, struct.pack('<I', len(raw)) + raw + self.jpeg, fmt=7)
        with HttpServer(payload) as server:
            frames = [value for value in Device(server.origin).observe(['gray_jpeg']) if value[0] == 'gray_jpeg']
            self.assertEqual(len(frames), 2)

    def test_image_rejections(self):
        bad_config = dict(self.config, width=1)
        bad_header = dict(self.header, random_access=False)
        for wire in (self.wire_image(config=bad_config), self.wire_image(header=bad_header),
                     self.wire_image(jpeg=b'not-jpeg'), self.wire_image()[:-1]):
            with HttpServer(wire) as server:
                with self.assertRaises(ValueError):
                    list(Device(server.origin).observe(['gray_jpeg']))

    @unittest.skipUnless(os.environ.get('SDK_CPP_IMAGE'), 'C++ image binary supplied by CTest')
    def test_cpp_image(self):
        invalid_seq = copy.deepcopy(self.header)
        invalid_seq['header']['seq'] = '18446744073709551616'
        for wire, succeeds in (
            (self.wire_image(), True), (self.wire_image()[:-1], False),
            (self.wire_image(config=dict(self.config, width=1)), False),
            (self.wire_image(header=dict(self.header, random_access=False)), False),
            (self.wire_image(header=invalid_seq), False),
            (self.wire_image(jpeg=b'not-jpeg'), False),
            (frame(6, 1, b'\xff\xd8\xff\xd9', fmt=7), False),
        ):
            (ROOT / 'tmp').mkdir(exist_ok=True)
            with tempfile.TemporaryDirectory(dir=ROOT / 'tmp') as directory, HttpServer(wire) as server:
                result = subprocess.run([os.environ['SDK_CPP_IMAGE'], server.origin, directory, '1'],
                                        capture_output=True, text=True, timeout=10)
                self.assertEqual(result.returncode == 0, succeeds, result.stderr)
                if succeeds:
                    self.assertEqual((Path(directory) / '1.jpg').read_bytes(), self.jpeg)
                    metadata = json.loads((Path(directory) / '1.json').read_text())
                    self.assertEqual(metadata, {'frame': self.header, 'config': self.config})
                    self.assertEqual(server.paths, ['/api/stream?channels=gray_jpeg'])


if __name__ == '__main__':
    unittest.main(verbosity=2)

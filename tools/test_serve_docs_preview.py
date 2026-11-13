from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
import tempfile
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from serve_docs_preview import PreviewHandler


class PreviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        scratch = Path(__file__).resolve().parents[1] / 'tmp'
        scratch.mkdir(exist_ok=True)
        cls.directory = tempfile.TemporaryDirectory(dir=scratch)
        cls.content = bytes(range(256))
        (Path(cls.directory.name) / 'sample.webm').write_bytes(cls.content)
        (Path(cls.directory.name) / 'index.html').write_text('preview', encoding='utf-8')
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(PreviewHandler, directory=cls.directory.name))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = 'http://127.0.0.1:' + str(cls.server.server_port)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()
        cls.directory.cleanup()

    def test_full_media(self):
        with urlopen(self.base + '/sample.webm?v=example') as response:
            self.assertEqual(response.status, 200)
            self.assertEqual(response.headers['Accept-Ranges'], 'bytes')
            self.assertEqual(response.read(), self.content)

    def test_ranges(self):
        for header, start, end in [('bytes=100-119', 100, 119), ('bytes=250-', 250, 255), ('bytes=-6', 250, 255), ('bytes=250-999', 250, 255)]:
            with self.subTest(header=header):
                with urlopen(Request(self.base + '/sample.webm', headers={'Range': header})) as response:
                    self.assertEqual(response.status, 206)
                    self.assertEqual(response.headers['Content-Range'], 'bytes ' + str(start) + '-' + str(end) + '/256')
                    self.assertEqual(int(response.headers['Content-Length']), end - start + 1)
                    self.assertEqual(response.read(), self.content[start:end + 1])

    def test_invalid_bounds(self):
        for header in ['bytes=999-', 'bytes=20-10', 'bytes=-0']:
            with self.subTest(header=header):
                with self.assertRaises(HTTPError) as caught:
                    urlopen(Request(self.base + '/sample.webm', headers={'Range': header}))
                self.assertEqual(caught.exception.code, 416)
                self.assertEqual(caught.exception.headers['Content-Range'], 'bytes */256')
                caught.exception.close()

    def test_html_is_not_cached(self):
        with urlopen(self.base + '/index.html') as response:
            self.assertEqual(response.headers['Cache-Control'], 'no-store')


if __name__ == '__main__':
    unittest.main()

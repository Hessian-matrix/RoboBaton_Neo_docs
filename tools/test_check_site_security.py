import io
from pathlib import Path
import tempfile
import unittest
import zipfile

from check_site_security import check_content, inspect, UnsafeArtifact


class PublicationSecurityTests(unittest.TestCase):
    def check(self, name, content):
        counts = {'html_pages': 0, 'archive_members': 0, 'external_scripts': set()}
        check_content(name, content, counts)
        return counts

    def test_python_examples_remain_available(self):
        self.check('neo_connect.py', b'import argparse\n')

    def test_native_program_with_renamed_extension(self):
        for signature in (b'MZ', b'\x7fELF', b'\xcf\xfa\xed\xfe'):
            with self.subTest(signature=signature), self.assertRaises(UnsafeArtifact):
                self.check('image.jpg', signature + b'payload')

    def test_windows_script_and_installer_names(self):
        for name in ('setup.EXE', 'setup.msi', 'install.ps1', 'shortcut.lnk'):
            with self.subTest(name=name), self.assertRaises(UnsafeArtifact):
                self.check(name, b'payload')

    def test_encoded_installer_link(self):
        with self.assertRaises(UnsafeArtifact):
            self.check('index.html', b'<a href="setup%2Eexe?download=1">Download</a>')

    def test_script_urls(self):
        for url in ('javascript:alert(1)', 'java&#10;script:alert(1)', 'data:text/html,payload'):
            with self.subTest(url=url), self.assertRaises(UnsafeArtifact):
                self.check('index.html', ('<a href="' + url + '">link</a>').encode())

    def test_local_resources_and_device_links(self):
        result = self.check('index.html', b'<script src="app.js"></script><a href="http://192.168.46.1">Device</a>')
        self.assertEqual(result['html_pages'], 1)

    def test_external_script_is_listed_for_review(self):
        result = self.check('index.html', b'<script src="https://cdn.example.test/runtime.js"></script>')
        self.assertEqual(result['external_scripts'], {'https://cdn.example.test/runtime.js'})
        with self.assertRaises(UnsafeArtifact):
            self.check('index.html', b'<script src="http://cdn.example.test/runtime.js"></script>')

    def archive(self, filename, content):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w') as archive:
            archive.writestr(filename, content)
        return buffer.getvalue()

    def test_archive_python_sources(self):
        result = self.check('sdk.zip', self.archive('SDK/client.py', b'print("example")'))
        self.assertEqual(result['archive_members'], 1)

    def test_archive_executable_and_traversal(self):
        for filename in ('SDK/install.exe', '../outside.py', '/absolute.py', 'C:/outside.py'):
            with self.subTest(filename=filename), self.assertRaises(UnsafeArtifact):
                self.check('sdk.zip', self.archive(filename, b'payload'))

    def test_nested_archive_program(self):
        with self.assertRaises(UnsafeArtifact):
            self.check('sdk.zip', self.archive('inner.zip', self.archive('picture.png', b'MZpayload')))

    def test_complete_artifact(self):
        scratch = Path(__file__).resolve().parents[1] / 'tmp'
        scratch.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=scratch) as temporary:
            directory = Path(temporary)
            (directory / 'index.html').write_text('<h1>Neo</h1>', encoding='utf-8')
            (directory / 'sdk.zip').write_bytes(self.archive('SDK/client.py', b'pass'))
            result = inspect(directory)
            self.assertEqual(result['files'], 2)
            self.assertEqual(result['archive_members'], 1)


if __name__ == '__main__':
    unittest.main()

import hashlib,unittest
from publish_firmware import verify,NAME
class FirmwareVerification(unittest.TestCase):
    def test_valid_and_corrupt(self):
        data=b'firmware-fixture';digest=hashlib.sha256(data).hexdigest()
        self.assertEqual(verify(data,digest+'  '+NAME),digest)
        with self.assertRaises(ValueError):verify(data+b'corrupt',digest+'  '+NAME)
        with self.assertRaises(ValueError):verify(data,digest+'  wrong.viofw')
        with self.assertRaises(ValueError):verify(data,'not a checksum')

class ReleaseNotes(unittest.TestCase):
    def test_summary_and_fallback(self):
        from publish_firmware import release_notes
        self.assertEqual(release_notes({'tag_name':'v1.0.1','body':'download instructions'}), '修复串口无法使用的问题；优化TF录制时的资源占用。')
        self.assertEqual(release_notes({'tag_name':'v999.0.0','body':' New fixes '}), 'New fixes')
        self.assertEqual(release_notes({'tag_name':'v999.0.0','body':None}), '')

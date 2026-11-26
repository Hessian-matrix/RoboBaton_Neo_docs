import hashlib,unittest
from publish_firmware import verify,NAME
class FirmwareVerification(unittest.TestCase):
    def test_valid_and_corrupt(self):
        data=b'firmware-fixture';digest=hashlib.sha256(data).hexdigest()
        self.assertEqual(verify(data,digest+'  '+NAME),digest)
        with self.assertRaises(ValueError):verify(data+b'corrupt',digest+'  '+NAME)
        with self.assertRaises(ValueError):verify(data,digest+'  wrong.viofw')
        with self.assertRaises(ValueError):verify(data,'not a checksum')

import io,unittest,zipfile
from check_public_information import scan

class PublicInformationTest(unittest.TestCase):
    def test_private_paths(self):
        for value in ('/home/VIO/parameters/x','/run/robobaton-update','BEGIN PRIVATE KEY'):
            with self.assertRaises(ValueError):scan('reference.json',value.encode())
    def test_archive(self):
        data=io.BytesIO()
        with zipfile.ZipFile(data,'w') as z:z.writestr('api.md','/home/VIO/parameters/x')
        with self.assertRaises(ValueError):scan('sdk.zip',data.getvalue())
    def test_public_contract(self):
        scan('api.md',b'/api/update sha256 CRC32 RBH1 RBR1 version build_id CLOCK_MONOTONIC_RAW')

if __name__=='__main__':unittest.main()

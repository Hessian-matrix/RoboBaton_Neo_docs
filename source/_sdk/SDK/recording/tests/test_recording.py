"""Synthetic RBR1 regression fixtures, not hardware acceptance."""
import io,json,struct,sys,tarfile,tempfile,unittest,zipfile,zlib
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from neo_recording import inspect,export

def encoded(value):return json.dumps(value,separators=(',',':')).encode()
def record(kind,channel,data,payload=b''):
    raw=encoded(data);head=struct.pack('<HHII',kind,channel,len(raw),len(payload))
    return head+struct.pack('<I',zlib.crc32(head+raw+payload))+raw+payload
def fixture(identifier='a'*32,number=1,volume=None,end_reason='user_stop',seqs=(1,2),codec='jpeg'):
    config={'format':'RBR1','recording_id':identifier,'channels':['imu','gray'],'gray':{'codec':codec}}
    if volume:config.update(session_id='session1',volume=volume)
    raw=encoded(config)
    head=struct.pack('<4sHHII32s12s',b'RBR1',1,64,number,len(raw),identifier.encode(),bytes(12))
    segment=head+struct.pack('<I',zlib.crc32(head+raw))+raw
    for seq in seqs:
        data={'header':{'seq':str(seq),'stamp':{'sec':12,'nanosec':seq}},'value':None,'random_access':False}
        meta={'source_epoch':'1','data':data}
        segment+=record(1,3,meta)+record(1,5,meta,bytes.fromhex('ffd8')+bytes([seq])+bytes.fromhex('ffd9'))
    segment+=record(3,0,{})
    result={'recording_id':identifier,'complete':True,'source_complete':None,'counts':{'imu':str(len(seqs)),'gray':str(len(seqs)),'color':'0','odometry':'0'},'end_reason':end_reason}
    if volume:result.update(session_id='session1',volume=volume)
    return {'manifest.json':encoded(config),'mono.conf':b'original calibration','result.json':encoded(result),'segments/%06d.rbr'%number:segment}

class RecordingTests(unittest.TestCase):
    def setUp(self):
        root=Path(__file__).resolve().parents[3]/'tmp';root.mkdir(exist_ok=True)
        self.temp=tempfile.TemporaryDirectory(dir=root);self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name)
    def write(self,members=None,name='input',kind='dir'):
        members=members or fixture();target=self.root/name
        if kind=='zip':
            with zipfile.ZipFile(target,'w') as a:
                for n,b in members.items():a.writestr(n,b)
        elif kind=='tar':
            with tarfile.open(target,'w') as a:
                for n,b in members.items():
                    info=tarfile.TarInfo('./'+n);info.size=len(b);a.addfile(info,io.BytesIO(b))
        else:
            target.mkdir()
            for n,b in members.items():
                p=target/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
        return target
    def test_archives_and_lossless_export(self):
        for kind in ('dir','zip','tar'):
            src=self.write(name=kind,kind=kind);self.assertTrue(inspect(src)['valid'])
            dest=self.root/('export-'+kind);self.assertTrue(export(src,dest)['valid'])
            files=list((dest/'recording-001/gray').glob('*.jpg'))
            self.assertEqual([p.read_bytes() for p in sorted(files)],[bytes.fromhex('ffd801ffd9'),bytes.fromhex('ffd802ffd9')])
            rows=[json.loads(x) for x in (dest/'recording-001/records.jsonl').read_text().splitlines()]
            self.assertEqual(rows[0]['metadata']['data']['header']['stamp'],{'sec':12,'nanosec':1})
            self.assertIsNone(rows[0]['metadata']['data']['value'])
            with self.assertRaises(FileExistsError):export(src,dest)
    def test_corruption_and_truncation_preserve_prefix(self):
        for mode in ('crc','tail'):
            m=fixture();key='segments/000001.rbr'
            m[key]=m[key][:-2] if mode=='tail' else m[key][:-1]+bytes([m[key][-1]^1])
            r=inspect(self.write(m,name=mode));self.assertFalse(r['valid']);self.assertGreater(r['recordings'][0]['segments'][0]['valid_bytes'],64)
    def test_count_mismatch_and_missing_calibration(self):
        m=fixture();r=json.loads(m['result.json']);r['counts']['imu']='9';m['result.json']=encoded(r)
        self.assertFalse(inspect(self.write(m))['valid'])
        m=fixture();del m['mono.conf'];self.assertFalse(inspect(self.write(m,name='no-calibration'))['valid'])
    def test_sequence_gaps(self):
        r=inspect(self.write(fixture(seqs=(1,3))));self.assertFalse(r['valid'])
        self.assertEqual(r['recordings'][0]['issue_counts']['sequence_gap_or_reset'],2)
    def test_traversal_and_duplicate_members(self):
        for i,n in enumerate(('../bad','/bad','C:/bad','a/../../bad')):
            with self.assertRaises(ValueError):inspect(self.write({n:b'bad'},name=str(i),kind='zip'))
        target=self.root/'duplicate.zip'
        with zipfile.ZipFile(target,'w') as a:
            a.writestr('a.rbr',b'a');a.writestr('./a.rbr',b'b')
        with self.assertRaises(ValueError):inspect(target)
    def test_symlink(self):
        target=self.root/'link.tar'
        with tarfile.open(target,'w') as a:
            info=tarfile.TarInfo('link');info.type=tarfile.SYMTYPE;info.linkname='../outside';a.addfile(info)
        with self.assertRaises(ValueError):inspect(target)
    def test_volumes_and_unknown_end(self):
        one=self.write(fixture(volume=1,end_reason='volume_rollover'),name='one',kind='zip')
        two=self.write(fixture(identifier='b'*32,volume=2),name='two',kind='zip')
        self.assertFalse(inspect(one)['valid']);self.assertTrue(inspect([one,two])['valid'])
        self.assertFalse(inspect(two)['valid']);self.assertFalse(inspect([one,one])['valid'])
    def test_missing_segment(self):
        self.assertFalse(inspect(self.write(fixture(number=2)))['valid'])
    def test_multiple_segments_and_identity(self):
        m=fixture();m['segments/000002.rbr']=fixture(number=2,seqs=(3,4))['segments/000002.rbr']
        r=json.loads(m['result.json']);r['counts'].update(imu='4',gray='4');m['result.json']=encoded(r)
        self.assertTrue(inspect(self.write(m))['valid'])
        r=json.loads(m['manifest.json']);r['recording_id']='f'*32;m['manifest.json']=encoded(r)
        self.assertFalse(inspect(self.write(m,name='mismatch'))['valid'])
    def test_timestamp_regression(self):
        report=inspect(self.write(fixture(seqs=(2,1))))
        self.assertFalse(report['valid'])
        self.assertEqual(report['recordings'][0]['issue_counts']['timestamp_regression'],2)
    def test_single_segment_unknown_completeness(self):
        folder=self.write()
        report=inspect(folder/'segments/000001.rbr')
        self.assertFalse(report['valid']);self.assertTrue(report['recordings'][0]['structurally_closed'])
    def test_malformed_sample_metadata(self):
        for index,header in enumerate(([],{'seq':'-1'},{'seq':'18446744073709551616'})):
            m=fixture();raw=m['segments/000001.rbr'];length=struct.unpack_from('<I',raw,12)[0]
            m['segments/000001.rbr']=raw[:64+length]+record(1,3,{'data':{'header':header}})+record(3,0,{})
            self.assertFalse(inspect(self.write(m,name=str(index)))['valid'])
    def test_video_export_keeps_access_units(self):
        dest=self.root/'out';report=export(self.write(fixture(codec='h264')),dest)
        self.assertTrue(report['valid'])
        folder=dest/'recording-001/gray'
        stream=(folder/'stream-0001.h264').read_bytes()
        self.assertEqual(stream,b''.join(p.read_bytes() for p in sorted(folder.glob('000*.h264'))))
        self.assertEqual(len(report['recordings'][0]['export_warnings']),1)

if __name__=='__main__':unittest.main()

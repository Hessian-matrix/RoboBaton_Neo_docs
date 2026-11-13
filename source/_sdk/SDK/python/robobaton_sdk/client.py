"""HTTP client. No ROS dependency."""
import argparse
import importlib.util
import json
import math
import re
import struct
import uuid
from pathlib import Path

_spec=importlib.util.spec_from_file_location('rb_public_transport',Path(__file__).with_name('transport.py'))
_base=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_base)
_camera_spec=importlib.util.spec_from_file_location("rb_preview_model",Path(__file__).with_name("camera_model.py"))
_camera=importlib.util.module_from_spec(_camera_spec);_camera_spec.loader.exec_module(_camera)

def depth_integer(value, maximum=2**64-1):
    if not isinstance(value,str) or not re.fullmatch(r'[1-9][0-9]{0,19}',value) or int(value)>maximum:
        raise ValueError('Invalid depth integer')
    return int(value)

def validate_depth_config(c):
    fixed=dict(encoding='raw',width=384,height=384,fps=5,dtype='float32',byte_order='little',layout='row_major',value_type='relative',unit=None,polarity='unverified',pixel_mapping='half_pixel')
    if not isinstance(c,dict) or set(c)!=set(fixed)|{'config_id','source_size','crop'} or any(type(c[k]) is not type(v) or c[k]!=v for k,v in fixed.items()):
        raise ValueError('Invalid depth configuration')
    if not isinstance(c['config_id'],str) or not re.fullmatch('[0-9a-f]{16}',c['config_id']) or c['source_size']!={'width':544,'height':640}:
        raise ValueError('Invalid depth identity/size')
    r=c['crop']
    if not isinstance(r,dict) or set(r)!={'x','y','width','height'} or any(type(v) is not int for v in r.values()) or not 384<=r['width']<=544 or r['width']%4 or r['height']!=r['width'] or r['x']!=(544-r['width'])/2 or r['y']!=(640-r['width'])/2:
        raise ValueError('Invalid depth crop')
    return c

def decode_depth(payload,config):
    validate_depth_config(config)
    if len(payload)<4:raise ValueError('Truncated depth prefix')
    n=struct.unpack_from('<I',payload)[0]
    if not 1<=n<=252 or len(payload)!=4+n+384*384*4:raise ValueError('Invalid depth length')
    f=json.loads(payload[4:4+n]);h=f.get('header') if isinstance(f,dict) else None
    if not isinstance(f,dict) or set(f)!={'header','pts_us'} or not isinstance(h,dict) or set(h)!={'seq','stamp'}:raise ValueError('Invalid depth frame')
    depth_integer(h['seq'],2**32-1);depth_integer(f['pts_us'])
    s=h['stamp']
    if s is not None and (not isinstance(s,dict) or set(s)!={'sec','nanosec'} or any(type(v) is not int for v in s.values()) or s['sec']<0 or not 0<=s['nanosec']<10**9 or not 0<s['sec']*10**9+s['nanosec']<=2**63-1):
        raise ValueError('Invalid depth stamp')
    f['binary']=payload[4+n:];return f

def validate_mount_config(value, response=False):
    fields={'robot_type','convention','camera_in_robot'} | ({'configured'} if response else set())
    if not isinstance(value,dict) or set(value)!=fields or value['robot_type'] not in ('car','drone','custom') or value['convention'] not in ('FLU','FRD'):
        raise ValueError('Invalid mount configuration fields')
    if response and type(value['configured']) is not bool:raise ValueError('Invalid configured flag')
    pose=value['camera_in_robot']
    if not isinstance(pose,dict) or set(pose)!={'position','orientation'}:raise ValueError('Invalid mount pose')
    for key,axes in [('position',{'x','y','z'}),('orientation',{'x','y','z','w'})]:
        v=pose[key]
        if not isinstance(v,dict) or set(v)!=axes or any(type(x) not in (int,float) or not math.isfinite(x) for x in v.values()):raise ValueError('Invalid mount vector')
    if any(abs(x)>10 for x in pose['position'].values()) or abs(sum(x*x for x in pose['orientation'].values())-1)>1e-5:
        raise ValueError('Mount requires a unit quaternion and position within +/-10 m')
    return value


def validate_vio_status(value):
    if not isinstance(value,dict) or set(value)!={'state','tracking','error','warning'} or value['state'] not in ('stopped','starting','running','stopping','restarting'):
        raise ValueError('Invalid VIO state')
    if value['tracking'] not in (None,'initializing','valid','invalid') or (value['state']!='running' and value['tracking'] is not None):
        raise ValueError('Invalid VIO tracking state')
    error=value['error']
    if value['warning'] not in (None,{'code':'CALIBRATION_REQUIRED'}):raise ValueError('Invalid VIO warning')
    if error is not None and (not isinstance(error,dict) or set(error)!={'code'} or not isinstance(error['code'],str) or not error['code']):
        raise ValueError('Invalid VIO error')
    return value

def validate_odometry(value):
    def fields(v, names):
        return isinstance(v,dict) and set(v)==set(names)
    def finite(v):
        return type(v) in (int,float) and math.isfinite(v)
    def vector(v,names=('x','y','z')):
        return fields(v,names) and all(finite(v[k]) for k in names)
    if not fields(value,('header','pose','twist','confidence','trip_distance_m')) or not fields(value['header'],('seq','stamp')):
        raise ValueError('Invalid odometry fields')
    seq,stamp=value['header']['seq'],value['header']['stamp']
    if not isinstance(seq,str) or not re.fullmatch(r'[1-9][0-9]{0,19}',seq) or int(seq)>2**64-1:
        raise ValueError('Invalid sequence')
    if stamp is not None and (not fields(stamp,('sec','nanosec')) or type(stamp['sec']) is not int or type(stamp['nanosec']) is not int or not 0<=stamp['nanosec']<10**9 or not 0<=stamp['sec']*10**9+stamp['nanosec']<=2**63-1):
        raise ValueError('Invalid stamp')
    pose,twist,confidence=value['pose'],value['twist'],value['confidence']
    if pose is not None and (not fields(pose,('position','orientation')) or not vector(pose['position']) or not vector(pose['orientation'],('x','y','z','w')) or abs(math.hypot(*pose['orientation'].values())-1)>1e-5):
        raise ValueError('Invalid pose')
    if twist is not None and (not fields(twist,('linear','angular')) or not vector(twist['linear']) or not vector(twist['angular'])):
        raise ValueError('Invalid twist')
    if confidence is not None and (not finite(confidence) or not 0<=confidence<=1):
        raise ValueError('Invalid confidence')
    distance=value['trip_distance_m']
    if distance is not None and (not finite(distance) or distance<0):
        raise ValueError('Invalid trip distance')
    return value

def validate_imu(value):
    def fields(v, names):
        return isinstance(v, dict) and set(v) == set(names)
    if not fields(value, ('header','linear_acceleration','angular_velocity')) or not fields(value['header'], ('seq','stamp')):
        raise ValueError('Invalid IMU fields')
    seq,stamp=value['header']['seq'],value['header']['stamp']
    if not isinstance(seq,str) or not re.fullmatch(r'(0|[1-9][0-9]{0,19})',seq) or int(seq)>2**64-1:
        raise ValueError('Invalid IMU sequence')
    if not fields(stamp,('sec','nanosec')) or type(stamp['sec']) is not int or type(stamp['nanosec']) is not int or stamp['sec']<0 or not 0<=stamp['nanosec']<10**9 or stamp['sec']*10**9+stamp['nanosec']>2**63-1:
        raise ValueError('Invalid IMU stamp')
    for key in ('linear_acceleration','angular_velocity'):
        if not fields(value[key],('x','y','z')) or any(type(v) not in (int,float) or not math.isfinite(v) for v in value[key].values()):
            raise ValueError('Invalid IMU vector')
    return value

def validate_color_config(value, limits=False):
    keys={'codec','width','height','fps','quality' if value.get('codec')=='mjpeg' else 'bitrate_kbps'}
    if limits:keys.add('fps_max')
    if set(value)!=keys or value['codec'] not in ('mjpeg','h264','h265') or value['width']!=1080 or value['height']!=1280:
        raise ValueError('Invalid color config')
    for k,lo,hi in [('fps',1,60),('quality',1,99),('bitrate_kbps',64,20000),('fps_max',1,60)]:
        if k in value and (type(value[k]) is not int or not lo<=value[k]<=hi):raise ValueError('Invalid color config field')
    if limits and value['fps']>value['fps_max']:raise ValueError('Invalid fps limit')
    return value

def decode_color(payload, config):
    if not 6<=len(payload)<=2*1024*1024+512:raise ValueError('Invalid color length')
    n=struct.unpack_from('<I',payload)[0]
    if not 1<=n<=508 or n+4>=len(payload) or len(payload)-4-n>2*1024*1024:raise ValueError('Invalid color prefix')
    v=json.loads(payload[4:4+n]);h=v.get('header',{});stamp=h.get('stamp')
    def u64(x):return isinstance(x,str) and re.fullmatch(r'(0|[1-9][0-9]{0,19})',x) and int(x)<2**64
    if set(v)!= {'header','pts_us','random_access'} or set(h)!= {'seq','stamp'} or not u64(h['seq']) or type(v['random_access']) is not bool:raise ValueError('Invalid color fields')
    if stamp is not None and (set(stamp)!={'sec','nanosec'} or type(stamp['sec']) is not int or type(stamp['nanosec']) is not int or stamp['sec']<0 or not 0<=stamp['nanosec']<10**9 or stamp['sec']*10**9+stamp['nanosec']>2**63-1):raise ValueError('Invalid color stamp')
    if config['codec']=='mjpeg':
        if v['pts_us'] is not None or not v['random_access']:raise ValueError('Invalid JPEG metadata')
    elif not u64(v['pts_us']):raise ValueError('Invalid color pts')
    return dict(v,data=payload[4+n:],config=config.copy())

def validate_gray_config(value):
    expected={'encoding':'raw','pixel_format':'mono8','width':544,'height':640,'stride':544,'fps':5}
    if not isinstance(value,dict) or value!=expected or any(type(value[k]) is not type(v) for k,v in expected.items()):
        raise ValueError('Invalid gray config')
    return value

def decode_gray(payload, config):
    validate_gray_config(config)
    if not 348165<=len(payload)<=348416:raise ValueError('Invalid gray length')
    n=struct.unpack_from('<I',payload)[0]
    if not 1<=n<=252 or len(payload)!=4+n+348160:raise ValueError('Invalid gray pixel length')
    v=json.loads(payload[4:4+n]);h=v.get('header',{}) if isinstance(v,dict) else {}
    if not isinstance(v,dict) or set(v)!={'header'} or not isinstance(h,dict) or set(h)!={'seq','stamp'}:
        raise ValueError('Invalid gray header')
    if not isinstance(h['seq'],str) or not re.fullmatch(r'[1-9][0-9]{0,19}',h['seq']) or int(h['seq'])>=2**64:
        raise ValueError('Invalid gray sequence')
    s=h['stamp']
    if s is not None and (not isinstance(s,dict) or set(s)!={'sec','nanosec'} or type(s['sec']) is not int or type(s['nanosec']) is not int or s['sec']<0 or not 0<=s['nanosec']<10**9 or s['sec']*10**9+s['nanosec']>2**63-1):
        raise ValueError('Invalid gray stamp')
    return dict(v,data=payload[4+n:],config=config.copy())

def validate_gray_jpeg_config(value):
    expected={'encoding':'jpeg','pixel_format':'mono8','width':544,'height':640,'quality':90,'frame_rate_mode':'source'}
    if not isinstance(value,dict) or value!=expected or any(type(value[k]) is not type(v) for k,v in expected.items()):raise ValueError('Invalid JPEG gray config')
    return value

def decode_gray_jpeg(payload, config):
    validate_gray_jpeg_config(config)
    if len(payload)>1048576+512:raise ValueError('JPEG gray message too large')
    value=decode_color(payload,{'codec':'mjpeg'})
    if value['header']['seq']=='0' or not value['data'].startswith(b'\xff\xd8') or not value['data'].endswith(b'\xff\xd9'):raise ValueError('Invalid JPEG gray frame')
    value['config']=config.copy();return value

class Device(_base.Device):
    def request(self,*args,**kwargs):
        raise ValueError('Use the HTTP command, stream or recording methods')

    def _tf_json(self, path, method='GET', body=None, key=None):
        c=self.connection(12)
        try:
            headers={} if body is None else {'Content-Type':'application/json','Idempotency-Key':key or str(uuid.uuid4())}
            c.request(method,'/api'+path,None if body is None else json.dumps(body).encode(),headers)
            response=c.getresponse();raw=response.read(262145)
            if len(raw)>262144:raise ValueError('TF response too large')
            value=None if response.status==204 else json.loads(raw)
            if response.status not in (200,202,204):raise RuntimeError(response.status,value)
            return value
        finally:c.close()

    @staticmethod
    def _recording_id(identifier):
        if not isinstance(identifier,str) or not re.fullmatch('[0-9a-f]{32}',identifier):raise ValueError('Invalid recording ID')
        return identifier

    def boot_config(self, value=None):
        """Read/save the next-boot VIO policy; never changes current VIO."""
        if value is not None and (not isinstance(value,dict) or set(value)!={'vio_autostart'} or type(value['vio_autostart']) is not bool):
            raise ValueError('Expected {vio_autostart: bool}')
        result=self._tf_json('/boot/config', 'GET' if value is None else 'POST', value)
        if not isinstance(result,dict) or set(result)!={'vio_autostart'} or type(result['vio_autostart']) is not bool:
            raise ValueError('Invalid boot configuration')
        return result

    def network_config(self, subnet=None):
        """Read active USB subnet, or request a change once; never retry POST."""
        if subnet is None:
            return self._tf_json('/network/config')
        if type(subnet) is not int or not 11 <= subnet <= 255:
            raise ValueError('subnet must be an integer from 11 to 255')
        return self._tf_json('/network/config', 'POST', {'subnet': subnet})

    def system_status(self):
        """Current boot ID and latest durable restart result; no side effects."""
        return self._tf_json('/system/status')

    def system_reboot(self, key):
        """Explicit restart, never automatically retried. Reuse key if uncertain."""
        if not isinstance(key, str) or not re.fullmatch(r'[A-Za-z0-9_.:-]{1,96}', key):
            raise ValueError('A persistent request key is required')
        return self._tf_json('/system/reboot', 'POST', {}, key)

    def buttons_config(self, config=None):
        """Read or fully replace the physical button configuration."""
        return self._tf_json('/buttons/config', 'GET' if config is None else 'POST', config)

    def serial_status(self):
        return self._tf_json('/serial/status')

    def mavlink_status(self, operation_id=None, request_key=None):
        from urllib.parse import urlencode
        if operation_id is not None and request_key is not None:
            raise ValueError('Choose operation_id or request_key')
        query = {'operation_id': operation_id} if operation_id is not None else {'request_key': request_key} if request_key is not None else {}
        return self._tf_json('/mavlink/status' + ('?' + urlencode(query) if query else ''))

    def mavlink_parameters(self, names):
        """Fresh named read, five-second total deadline; no all-parameter dump."""
        names = list(dict.fromkeys(names))
        if not 1 <= len(names) <= 32 or any(not isinstance(n, str) or not re.fullmatch('[A-Za-z0-9_]{1,16}', n) for n in names):
            raise ValueError('Expected 1–32 ASCII parameter names')
        return self._tf_json('/mavlink/parameters?names=' + ','.join(names))

    def mavlink_action(self, action, *, key, **arguments):
        """One submission only. Keep key and query by request_key if the reply is lost."""
        key = str(uuid.UUID(key))
        return self._tf_json('/mavlink', 'POST', {'action': action, **arguments}, key)

    def mavlink_set_parameters(self, parameters, *, key):
        """Types come from the controller; never automatically retry a write."""
        key = str(uuid.UUID(key))
        return self._tf_json('/mavlink/parameters', 'POST', {'parameters': parameters}, key)

    def recording(self):
        return self._tf_json('/recording')

    def start_recording(self, channels=('gray','imu'), key=None):
        channels=list(channels)
        if not channels or len(set(channels))!=len(channels) or not set(channels)<={'gray','imu','color','odometry'}:raise ValueError('Invalid recording channels')
        return self._tf_json('/recording','POST',{'action':'start','channels':channels},key)

    def stop_recording(self, identifier, key=None):
        return self._tf_json('/recording','POST',{'action':'stop','recording_id':self._recording_id(identifier)},key)

    def monitor(self):
        return self._tf_json('/monitor')

    @staticmethod
    def _check_channels(channels):
        channels=list(channels)
        if not channels or len(set(channels))!=len(channels) or not set(channels)<={'gray','imu','color','odometry'}:
            raise ValueError('Invalid preflight channels')
        return channels

    def recording_check(self, channels=('gray','imu')):
        return self._tf_json('/recording/check?channels='+','.join(self._check_channels(channels)))

    def start_recording_check(self, channels=('gray','imu'), key=None):
        return self._tf_json('/recording/check','POST',{'action':'start','channels':self._check_channels(channels)},key)

    def cancel_recording_check(self, identifier, key=None):
        return self._tf_json('/recording/check','POST',{'action':'stop','check_id':self._recording_id(identifier)},key)

    def datasets(self, limit=20, offset=0):
        if type(limit) is not int or type(offset) is not int or not 1<=limit<=100 or not 0<=offset<=10000:raise ValueError('Invalid page')
        return self._tf_json('/datasets?limit=%d&offset=%d'%(limit,offset))

    def dataset(self, identifier):
        return self._tf_json('/datasets/'+self._recording_id(identifier))

    def delete_dataset(self, identifier):
        return self._tf_json('/datasets/'+self._recording_id(identifier),'DELETE')

    def download_dataset(self, identifier, output):
        """Write tar chunks to a caller-owned binary file; no archive buffering."""
        c=self.connection(15)
        try:
            c.request('GET','/api/datasets/'+self._recording_id(identifier)+'/archive')
            response=c.getresponse()
            if response.status!=200:raise RuntimeError(response.status,response.read(4096))
            while block:=response.read(65536):output.write(block)
        finally:c.close()

    def calibration_parameters(self, value=None):
        """Read effective DS parameters or save a complete calibration.

        GET source=default is not a saved calibration. Source is read-only.
        """
        import importlib.util
        spec=importlib.util.spec_from_file_location('calibration',Path(__file__).with_name('calibration.py'))
        model=importlib.util.module_from_spec(spec);spec.loader.exec_module(model)
        if value is not None:
            model.validate(value)
            value={k:v for k,v in value.items() if k!='source'}
        c=self.connection(12)
        try:
            c.request('GET' if value is None else 'POST','/api/calibration/parameters',
                      None if value is None else json.dumps(value,allow_nan=False).encode(),
                      {} if value is None else {'Content-Type':'application/json'})
            r=c.getresponse();raw=r.read(4097)
            if len(raw)>4096:raise ValueError('Calibration response too large')
            result=json.loads(raw)
            if r.status!=200:raise RuntimeError(r.status,result)
            if result.get('source') not in ('default','saved'):raise ValueError('Missing calibration source')
            if value is not None and result['source']!='saved':raise ValueError('Calibration save not confirmed')
            return model.validate(result)
        finally:c.close()

    def mount_config(self, value=None):
        """Read/save persisted serial mount, including while VIO runs.

        Success confirms storage, not application to the current instance.
        VIO loads it on its next start; saving never starts/stops/restarts VIO.
        """
        if value is not None:validate_mount_config(value)
        c=self.connection(12)
        try:
            c.request('GET' if value is None else 'POST','/api/mount/config',
                      None if value is None else json.dumps(value,allow_nan=False).encode(),
                      {} if value is None else {'Content-Type':'application/json'})
            r=c.getresponse();raw=r.read(4097)
            if len(raw)>4096:raise ValueError('Mount response too large')
            result=json.loads(raw)
            if r.status!=200:raise RuntimeError(r.status,result)
            return validate_mount_config(result,True)
        finally:c.close()

    def color_config(self, value=None):
        c=self.connection(12)
        try:
            c.request('GET' if value is None else 'POST','/api/color/config',None if value is None else json.dumps(value),{} if value is None else {'Content-Type':'application/json'})
            r=c.getresponse();raw=r.read(4097)
            if len(raw)>4096:raise ValueError('Config response too large')
            v=json.loads(raw)
            if r.status!=200:raise RuntimeError(r.status,v)
            return validate_color_config(v,True)
        finally:c.close()

    def vio_status(self):
        return validate_vio_status(self._tf_json('/vio'))

    def depth_config(self):
        return validate_depth_config(self._tf_json('/depth/config'))

    def command(self,action,key=None):
        if action not in ('start','stop','restart'):
            raise ValueError('Choose start, stop or restart')
        key=key or str(uuid.uuid4())
        c=self.connection()
        try:
            c.request('POST','/api/vio',json.dumps({'action':action}).encode(),{'Content-Type':'application/json','Idempotency-Key':key})
            r=c.getresponse();raw=r.read(4097)
            if len(raw)>4096:raise ValueError('Command response too large')
            reply=json.loads(raw)
            if r.status!=202 or reply!={'action':action,'accepted':True}:
                raise RuntimeError(reply)
            return reply # Acceptance only. Keep the same key if transport failed.
        finally:c.close()

    def observe(self,channels=('odometry',)):
        channels=tuple(channels)
        if channels not in (('preview',),('odometry',),('imu',),('color',),('gray',),('gray_jpeg',),('depth',)):
            raise ValueError('Choose one preview, odometry, imu, color, gray, gray_jpeg or depth stream')
        name=channels[0];c=self.connection(32 if name=='depth' else 10);r=None;model=_camera.Model()
        try:
            c.request('GET','/api/stream?channels='+name);r=c.getresponse()
            if r.status!=200:raise RuntimeError(r.read(4096).decode(errors='replace'))
            if r.getheader('Content-Type','').replace(' ','')!='application/vnd.robobaton.stream':
                raise ValueError('Unsupported stream version')
            mapping=None;color_config=None;color_last=None;gray_config=None;gray_last=None;gray_stamp=None;depth_config=None;depth_pts=None
            for channel,fmt,sequence,payload in _base.records(r,formats=(1,6,7,8,9)):
                if channel==0:
                    if fmt!=1:raise ValueError('Invalid control format')
                    control=json.loads(payload)
                    if control.get('type')=='metadata':
                        expected=[{'id':{'preview':1,'odometry':2,'imu':3,'color':4,'gray':5,'gray_jpeg':6,'depth':7}[name],'name':name,'format':9 if name=='depth' else 6 if name=='preview' else 7 if name in ('color','gray_jpeg') else 8 if name=='gray' else 1}]
                        if mapping is not None or control.get('stream',{}).get('channels')!=expected:
                            raise ValueError('Unexpected stream metadata')
                        mapping=expected[0]
                        if name=='color':color_config=validate_color_config(control.get('config',{}))
                        if name=='gray':gray_config=validate_gray_config(control.get('config',{}))
                        if name=='gray_jpeg':color_config=validate_gray_jpeg_config(control.get('config',{}))
                        if name=='depth':
                            depth_config=validate_depth_config(control.get('config',{}));depth_integer(control.get('source_epoch'));depth_integer(control.get('stream_epoch'))
                    elif control.get('type')=='error':raise RuntimeError(control)
                    else:model.control(control)
                    yield 'control',1,sequence,control
                else:
                    if mapping is None or channel!=mapping['id'] or fmt!=mapping['format']:raise ValueError('Data before metadata or mismatched channel')
                    if name in ('color','gray_jpeg'):
                        data=(decode_gray_jpeg if name=='gray_jpeg' else decode_color)(payload,color_config);seq=int(data['header']['seq'])
                        if color_last is None and not data['random_access']:raise ValueError('Color must start at random access')
                        if color_last is not None and (seq<=color_last or (color_config.get('codec') in ('h264','h265') and seq!=color_last+1)):raise ValueError('Color sequence gap')
                        color_last=seq
                    elif name in ('gray','depth'):
                        data=decode_depth(payload,depth_config) if name=='depth' else decode_gray(payload,gray_config);seq=int(data['header']['seq']);stamp=data['header']['stamp']
                        if name=='depth':
                            pts=int(data['pts_us'])
                            if depth_pts is not None and pts<=depth_pts:raise ValueError('Depth PTS regressed')
                            depth_pts=pts
                        if gray_last is not None and seq<=gray_last:raise ValueError('Gray sequence regressed')
                        if stamp is not None:
                            ns=stamp['sec']*10**9+stamp['nanosec']
                            if gray_stamp is not None and ns<=gray_stamp:raise ValueError('Gray stamp regressed')
                            gray_stamp=ns
                        gray_last=seq
                    else:data=model.decode(payload,name) if name=='preview' else (validate_imu if name=='imu' else validate_odometry)(json.loads(payload))
                    yield name,fmt,sequence,data
        finally:
            if r is not None:r.close()
            c.close()

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('origin');parser.add_argument('--channel',choices=['preview','odometry','imu','color','gray','gray_jpeg','depth'],default='odometry')
    parser.add_argument('--color-config',nargs='?',const='',help='Query config, or apply a JSON config')
    parser.add_argument('--vio-status',action='store_true',help='Read actual VIO process and tracking status')
    parser.add_argument('--depth-config',action='store_true',help='Read the fixed relative depth output configuration')
    parser.add_argument('--action',choices=['start','stop','restart']);parser.add_argument('--key')
    parser.add_argument('--messages',type=int,default=10)
    args=parser.parse_args();device=Device(args.origin)
    if args.vio_status:print(json.dumps(device.vio_status(),ensure_ascii=False))
    elif args.depth_config:print(json.dumps(device.depth_config(),ensure_ascii=False))
    elif args.color_config is not None:print(json.dumps(device.color_config(json.loads(args.color_config) if args.color_config else None)))
    elif args.action:print(json.dumps(device.command(args.action,args.key),ensure_ascii=False))
    else:
        stream=device.observe([args.channel]);count=0
        try:
            for name,fmt,seq,data in stream:
                if name=='control':continue
                print(json.dumps(data,ensure_ascii=False,default=lambda b:'<%d bytes>'%len(b)))
                count+=1
                if args.messages>0 and count>=args.messages:break
        finally:stream.close()

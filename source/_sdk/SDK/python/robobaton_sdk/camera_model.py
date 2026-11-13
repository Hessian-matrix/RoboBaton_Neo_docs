"""HTTP preview RBF2 parser, no ROS dependency."""
import json
import struct

MAX_BINARY=2*1024*1024

def uint(value):
    if not isinstance(value,str) or not value.isascii() or not value.isdecimal() or str(int(value))!=value or int(value)>2**64-1:
        raise ValueError('Invalid decimal uint64 string')
    return int(value)

class Model:
    def __init__(self):
        self.context=None
        self.descriptors={}

    def control(self,event):
        if event['type']=='device_context':
            context=event['context']
            if self.context is not None or context.get('schema_version')!=2 or not context.get('boot_id'):
                raise ValueError('Invalid or duplicate context')
            self.context=context
        if event['type']=='descriptor':
            key=event['descriptor_id'];d=event['descriptor']
            if not self.context or d.get('stream_id')!='preview' or d.get('kind')!='image' or len(key)!=64 or any(c not in '0123456789abcdef' for c in key) or d.get('schema_version')!=2 or d.get('boot_id')!=self.context['boot_id']:
                raise ValueError('Invalid descriptor / boot')
            if key in self.descriptors and self.descriptors[key]!=d:
                raise ValueError('Immutable descriptor changed')
            if key not in self.descriptors and len(self.descriptors)>=256:
                raise ValueError('Descriptor limit')
            self.descriptors[key]=d

    def decode(self,payload,channel):
        if len(payload)<16:
            raise ValueError('Short RBF2 header')
        magic,version,size,n,b=struct.unpack_from('<4sHHII',payload)
        if (magic,version,size)!=(b'RBF2',2,16) or not 0<n<=8192 or b>MAX_BINARY or len(payload)!=16+n+b:
            raise ValueError('Invalid RBF2 lengths/version')
        frame=json.loads(payload[16:16+n]);data=payload[16+n:]
        header=frame.get('header');key=header['descriptor_id'] if header else frame['descriptor_id']
        d=self.descriptors.get(key)
        if not d or d.get('stream_id')!=channel or d.get('kind')!=frame.get('kind') or frame.get('schema_version')!=2:
            raise ValueError('Frame before descriptor or wrong channel')
        if not header:raise ValueError('Missing image header')
        if header:
            uint(header['sequence'])
            if header['flags'] not in (0,1):raise ValueError('Unknown header flags')
            if header['flags']&1:uint(header['timestamp_ns'])
            elif header['timestamp_ns'] is not None:raise ValueError('Invalid time must be null')
        kind=frame['kind']
        if kind=='image':
            source=frame['source']
            uint(source['source_epoch']);uint(source['key'])
            if source['sensor_id']!='cam0' or source['key_kind']!='pts_us':
                raise ValueError('Invalid source identity')
            if d.get('source_epoch') is not None and source['source_epoch']!=d['source_epoch']:
                raise ValueError('Source epoch does not match descriptor')
        if kind=='image':
            if not b or d['encoding'] not in ('jpeg','h264','h265') or not 0<d['width']<=4096 or not 0<d['height']<=4096 or d['pixel_format'] is not None:
                raise ValueError('Invalid image')
            if d['encoding']!='jpeg':
                video=frame['video'];uint(video['pts_ticks'])
                if int(video['pts_ticks'])>2**63-1 or d['config']['bitstream_format']!='annex_b' or not d['config']['access_unit'] or not isinstance(video['random_access'],bool):raise ValueError('Invalid video timing/config')
                bytes.fromhex(d['config']['decoder_config_hex'])
        else:raise ValueError('Unknown model kind')
        return dict(frame=frame,descriptor=d,descriptor_id=key,data=data)

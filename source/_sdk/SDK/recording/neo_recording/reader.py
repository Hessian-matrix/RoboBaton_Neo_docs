"""Streaming archive reader. Archive paths are never extracted to the filesystem."""
from contextlib import ExitStack,contextmanager
from pathlib import Path,PurePosixPath
import csv,json,re,tarfile,zipfile
from collections import Counter

class Issues(list):
    def __init__(self):
        super().__init__(); self.counts=Counter()
    def append(self,item):
        self.counts[item['type']]+=1
        if len(self)<100:super().append(item)
from .rbr import records,CHANNELS,_json

MAX_MEMBERS=100000
MAX_JSON=4*1024*1024

def safe_name(name):
    p=PurePosixPath(name)
    if not name or p.is_absolute() or '..' in p.parts or chr(92) in name or ':' in name:
        raise ValueError('Unsafe archive member: '+name)
    return p.as_posix()

@contextmanager
def sources(inputs):
    if isinstance(inputs,(str,Path)):inputs=[inputs]
    with ExitStack() as stack:
        entries=[]
        for index,value in enumerate(inputs):
            path=Path(value)
            if not path.exists():raise ValueError('Input not found: '+str(path))
            if path.is_symlink():raise ValueError('Symbolic links are not supported')
            members={}
            def add(name,opener,size):
                name=safe_name(name)
                if name in members:raise ValueError('Duplicate archive member: '+name)
                if len(members)>=MAX_MEMBERS:raise ValueError('Too many archive entries')
                members[name]=(opener,size)
            if path.is_dir():
                for file in sorted(path.rglob('*')):
                    if file.is_symlink():raise ValueError('Symbolic links are not supported')
                    if file.is_file():add(file.relative_to(path).as_posix(),lambda f=file:f.open('rb'),file.stat().st_size)
            elif zipfile.is_zipfile(path):
                archive=stack.enter_context(zipfile.ZipFile(path))
                for item in archive.infolist():
                    safe_name(item.filename)
                    if (item.external_attr>>16)&0o170000==0o120000:raise ValueError('Archive links are not supported')
                    if not item.is_dir():add(item.filename,lambda a=archive,i=item:a.open(i),item.file_size)
            elif path.name.endswith(('.rbr','.rbr.part')):
                add(path.name,lambda p=path:p.open('rb'),path.stat().st_size)
            else:
                archive=stack.enter_context(tarfile.open(path,'r:*'))
                for item in archive:
                    safe_name(item.name)
                    if item.issym() or item.islnk():raise ValueError('Archive links are not supported')
                    if item.isfile():add(item.name,lambda a=archive,i=item:a.extractfile(i),item.size)
                    elif not item.isdir():raise ValueError('Unsupported archive entry')
            for name,(opener,size) in members.items():
                if not name.endswith(('.rbr','.rbr.part')):continue
                parent=PurePosixPath(name).parent
                group=parent.parent if parent.name=='segments' else parent
                entries.append({'input':str(path),'key':(index,group.as_posix()),'name':name,'open':opener,'size':size,'members':members,'parent':group})
        if not entries:raise ValueError('No RBR1 segments found')
        yield sorted(entries,key=lambda x:(x['key'],x['name']))

def companion(entry,name):
    target=(entry['parent']/name).as_posix()
    item=entry['members'].get(target)
    if item is None:return None
    opener,size=item
    if size>MAX_JSON:raise ValueError('Companion file too large: '+target)
    with opener() as stream:return stream.read(MAX_JSON+1)

def iter_records(inputs):
    """Yield (segment name, record); payload bytes are consumed one record at a time."""
    with sources(inputs) as entries:
        for entry in entries:
            with entry['open']() as stream:
                for row in records(stream):yield entry['name'],row

def _run(inputs,output=None):
    report={'valid':True,'recordings':[],'sessions':[],'session_warnings':[], 'scope':'V2.0.0; structural checks do not prove lossless source capture'}
    seen_ids=set();sessions={}
    with sources(inputs) as entries,ExitStack() as outputs:
        groups={}
        for entry in entries:groups.setdefault(entry['key'],[]).append(entry)
        for group_index,parts in enumerate(groups.values()):
            item={'input':parts[0]['input'],'recording_id':None,'counts':dict.fromkeys(CHANNELS.values(),0),'segments':[], 'issues':Issues(), 'structurally_closed':True,'declared_complete':None,'source_complete':None}
            report['recordings'].append(item);expected=1;previous={};previous_stamp={};video_streams={};payload_count=0
            directory=None;index_file=None;writers={}
            if output:
                directory=output/('recording-'+str(group_index+1).zfill(3));directory.mkdir()
                index_file=outputs.enter_context((directory/'records.jsonl').open('w',encoding='utf8'))
                for channel in ('imu','odometry'):
                    f=outputs.enter_context((directory/(channel+'.csv')).open('w',newline='',encoding='utf8'))
                    w=csv.writer(f);w.writerow(['segment','source_epoch','seq','stamp_sec','stamp_nanosec','data_json']);writers[channel]=w
                for name in ('manifest.json','result.json','mono.conf','calibration.json'):
                    raw=companion(parts[0],name)
                    if raw is not None:(directory/name).write_bytes(raw)
            for part in parts:
                seg={'file':part['name'],'ended':False,'valid_bytes':0};item['segments'].append(seg)
                try:
                    name=PurePosixPath(part['name']).name
                    number=int(name.split('.')[0]) if re.fullmatch('[0-9]+[.]rbr([.]part)?',name) else None
                    if len(parts)>1 or PurePosixPath(part['name']).parent.name=='segments':
                        if number!=expected:raise ValueError('Missing, duplicate or unordered segment')
                    with part['open']() as stream:
                        for row in records(stream,item['recording_id'],number):
                            seg['valid_bytes']=row['valid_bytes']
                            if row['type']=='config':
                                config=row['config'];identity=config['recording_id']
                                if item['recording_id'] is None:
                                    if identity in seen_ids:raise ValueError('Duplicate recording ID across inputs')
                                    seen_ids.add(identity);item['recording_id']=identity
                                if directory:(directory/('config-'+str(expected)+'.json')).write_text(json.dumps(config,indent=2),encoding='utf8')
                                continue
                            if row['type']=='end':seg['ended']=True
                            payload=row['payload'];channel=row['channel'];meta=row['metadata'];data=meta.get('data',{})
                            if row['type']=='data':
                                item['counts'][channel]+=1
                                header=data.get('header',{}) if isinstance(data,dict) else {}
                                if not isinstance(header,dict):raise ValueError('Invalid sample header')
                                stamp=header.get('stamp');seq=header.get('seq');epoch=(channel,str(meta.get('source_epoch')),str(meta.get('stream_epoch')),str(meta.get('subscription_index')))
                                if seq is not None:
                                    if not isinstance(seq,(str,int)) or isinstance(seq,bool) or not re.fullmatch('[0-9]+',str(seq)) or len(str(seq))>20:raise ValueError('Invalid sequence')
                                    n=int(seq);old=previous.get(epoch)
                                    if n>18446744073709551615:raise ValueError('Sequence outside uint64 range')
                                    if old is not None and n!=old+1:item['issues'].append({'type':'sequence_gap_or_reset','channel':channel,'previous':str(old),'current':str(n)})
                                    previous[epoch]=n
                                else:item['issues'].append({'type':'missing_sequence','channel':channel})
                                if stamp is None:item['issues'].append({'type':'missing_timestamp','channel':channel})
                                elif not isinstance(stamp,dict) or type(stamp.get('sec')) is not int or type(stamp.get('nanosec')) is not int or not 0<=stamp['nanosec']<1000000000:
                                    raise ValueError('Invalid timestamp')
                                else:
                                    timestamp=stamp['sec']*1000000000+stamp['nanosec']
                                    if epoch in previous_stamp and timestamp<previous_stamp[epoch]:item['issues'].append({'type':'timestamp_regression','channel':channel})
                                    previous_stamp[epoch]=timestamp
                                if directory and channel in writers:
                                    stamp=stamp or {};writers[channel].writerow([part['name'],meta.get('source_epoch'),seq,stamp.get('sec'),stamp.get('nanosec'),json.dumps(data,ensure_ascii=False)])
                            if directory:
                                saved={k:v for k,v in row.items() if k!='payload'};saved['segment']=part['name']
                                if payload:
                                    payload_count+=1
                                    codec=config.get(channel,{}).get('codec','') if isinstance(config.get(channel),dict) else ''
                                    ext='jpg' if codec in ('jpeg','mjpeg') else codec if codec in ('h264','h265') else 'bin'
                                    folder=directory/(channel or 'events');folder.mkdir(exist_ok=True)
                                    filename=folder/(str(payload_count).zfill(9)+'.'+ext);filename.write_bytes(payload)
                                    saved['payload_file']=filename.relative_to(directory).as_posix()
                                    if codec in ('h264','h265'):
                                        key=(part['name'],channel,str(meta.get('source_epoch')),str(meta.get('stream_epoch')),str(meta.get('subscription_index')))
                                        if key not in video_streams:
                                            video=folder/('stream-'+str(len(video_streams)+1).zfill(4)+'.'+codec)
                                            video_streams[key]=(None,video,0)
                                            if data.get('random_access') is not True:item.setdefault('export_warnings',[]).append({'type':'video_requires_previous_volume_or_next_random_access','file':video.relative_to(directory).as_posix()})
                                        handle,video,offset=video_streams[key]
                                        with video.open('ab') as stream_output:stream_output.write(payload)
                                        saved['stream_file']=video.relative_to(directory).as_posix();saved['stream_offset']=offset;saved['stream_bytes']=len(payload)
                                        video_streams[key]=(handle,video,offset+len(payload))
                                index_file.write(json.dumps(saved,ensure_ascii=False)+chr(10))
                    if part['name'].endswith('.part'):item['issues'].append({'type':'unfinished_part','file':part['name']})
                    expected+=1
                except (ValueError,UnicodeError,OSError,KeyError,TypeError) as error:
                    seg['error']=str(error);item['structurally_closed']=False;report['valid']=False
                    break
            item['structurally_closed']=item['structurally_closed'] and all(s['ended'] for s in item['segments'])
            try:
                raw_manifest=companion(parts[0],'manifest.json')
                manifest=_json(raw_manifest) if raw_manifest else None
                if manifest is None:item['issues'].append({'type':'missing_manifest'})
                elif manifest.get('recording_id')!=item['recording_id'] or manifest.get('format')!='RBR1':raise ValueError('Manifest identity/format mismatch')
                raw=companion(parts[0],'result.json');final=_json(raw) if raw else None
                item['result']=final
                if final:
                    if final.get('recording_id')!=item['recording_id']:raise ValueError('result recording ID mismatch')
                    item['declared_complete']=final.get('complete');item['source_complete']=final.get('source_complete')
                    if final.get('source_complete') is False:item['issues'].append({'type':'source_incomplete'})
                    if any(str(final.get('counts',{}).get(k))!=str(v) for k,v in item['counts'].items()):raise ValueError('Result counts mismatch')
                    session=final.get('session_id');volume=final.get('volume')
                    if manifest and (manifest.get('session_id')!=session or manifest.get('volume')!=volume):raise ValueError('Manifest/result session mismatch')
                    if session is not None and volume is not None:sessions.setdefault(str(session),[]).append({'volume':int(volume),'end_reason':final.get('end_reason')})
                    if final.get('session_has_known_issues'):item['issues'].append({'type':'session_has_known_issues'})
                else:item['issues'].append({'type':'missing_result'})
                if companion(parts[0],'mono.conf') is None:item['issues'].append({'type':'missing_calibration'})
            except (ValueError,OSError,KeyError,TypeError) as error:
                item['issues'].append({'type':'invalid_companion','error':str(error)});report['valid']=False
            item['issue_counts']=dict(item['issues'].counts)
            item['complete']=item['structurally_closed'] and item['declared_complete'] is True and not item['issues']
            if not item['complete']:report['valid']=False
        for session,volumes in sessions.items():
            values=sorted(v['volume'] for v in volumes)
            terminal=any(v['end_reason']=='user_stop' for v in volumes)
            report['sessions'].append({'session_id':session,'volumes':values,'terminal_volume_present':terminal,'source_complete':None})
            if not terminal:
                report['session_warnings'].append({'session_id':session,'type':'session_end_not_observed'});report['valid']=False
            if any(v!=i for i,v in enumerate(values,1)):
                report['session_warnings'].append({'session_id':session,'type':'missing_or_duplicate_volume','volumes':values});report['valid']=False
    return report

def inspect(inputs):return _run(inputs)

def export(inputs,destination):
    output=Path(destination);output.mkdir(parents=True,exist_ok=False)
    try:report=_run(inputs,output)
    except Exception as error:
        (output/'FAILED.txt').write_text(str(error),encoding='utf8');raise
    (output/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    return report

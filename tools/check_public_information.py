"""Reject private board implementation and firmware security details, including ZIP members."""
import argparse,io,re,zipfile
from pathlib import Path

PATTERN=re.compile(r'Ed25519|VFW2|key_id|payload_sha256|minimum_updater|BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY|system-ab-2|/home/(?:VIO|[.]robobaton)|/run/robobaton|/proc/sys/kernel|/sys/block/mmc|S(?:20|21|30|31)-(?:usb|usbncm)|10[.]21[.]12[.]53|PL011|robobaton[.]neo[.]tf|加密部署|二进制加密|签名格式|私钥|密钥',re.I)
TEXT={'.html','.json','.md','.rst','.py','.js','.txt','.c','.h','.hpp','.cpp','.svg','.vtt'}
def scan(name,data):
    if name.endswith('.zip'):
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            for entry in archive.infolist():
                if not entry.is_dir():scan(name+'!'+entry.filename,archive.read(entry))
    elif Path(name).suffix.lower() in TEXT:
        text=data.decode('utf-8-sig',errors='replace')
        match=PATTERN.search(text)
        if match:raise ValueError('Private implementation detail in '+name+' (rule '+str(match.start())+')')
def main():
    p=argparse.ArgumentParser();p.add_argument('directory',nargs='?',default='tmp/site');args=p.parse_args()
    count=0
    for file in Path(args.directory).rglob('*'):
        if file.is_file():scan(str(file),file.read_bytes());count+=1
    print('PASS: public information scan, including nested SDK downloads; '+str(count)+' files')
if __name__=='__main__':main()

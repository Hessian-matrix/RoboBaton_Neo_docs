import hashlib,json,os,re,shutil,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
REPO='Hessian-matrix/RoboBaton_Neo_docs'
BASE='https://hessian-matrix.github.io/RoboBaton_Neo_docs/'
NAME='RoboBaton-Neo.viofw'
def fetch(url,api=False):
    headers={'User-Agent':'RoboBaton-firmware-publisher'}
    if api and os.environ.get('GITHUB_TOKEN'): headers['Authorization']='Bearer '+os.environ['GITHUB_TOKEN']
    with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=120) as r:return r.read()
def verify(data,checksum):
    fields=checksum.split()
    if len(fields)!=2 or fields[1].lstrip('*')!=NAME or not re.fullmatch('[0-9a-fA-F]{64}',fields[0]):raise ValueError('Invalid checksum file')
    digest=hashlib.sha256(data).hexdigest()
    if not data or digest!=fields[0].lower():raise ValueError('Firmware SHA256 verification failed')
    return digest

def main():
    latest=json.loads(fetch(f'https://api.github.com/repos/{REPO}/releases/latest',True))
    releases=[]; page=1
    while True:
        batch=json.loads(fetch(f'https://api.github.com/repos/{REPO}/releases?per_page=100&page={page}',True));releases.extend(batch)
        if len(batch)<100:break
        page+=1
    dest=ROOT/'tmp/site/firmware';dest.mkdir(parents=True,exist_ok=True);manifest=None
    for release in releases:
        if release['draft'] or release['prerelease']:continue
        assets={a['name']:a for a in release['assets']}
        if NAME not in assets:continue
        tag=release['tag_name']
        if not re.fullmatch(r'v[0-9]+[.][0-9]+[.][0-9]+',tag):raise ValueError('Unsupported tag: '+tag)
        data=fetch(assets[NAME]['browser_download_url']);digest=verify(data,fetch(assets[NAME+'.sha256']['browser_download_url']).decode('utf-8-sig'))
        if len(data)!=assets[NAME]['size']:raise ValueError('Size mismatch')
        folder=dest/tag;folder.mkdir(parents=True,exist_ok=True)
        (folder/NAME).write_bytes(data);(folder/(NAME+'.sha256')).write_text(digest+'  '+NAME+chr(10),encoding='utf8')
        if release['id']==latest['id']:
            manifest={'version':tag[1:],'tag':tag,'url':BASE+'firmware/'+tag+'/'+NAME,'sha256':digest,'size':len(data),'published_at':release['published_at']}
            alias=dest/'latest';alias.mkdir(exist_ok=True)
            for name in (NAME,NAME+'.sha256'):shutil.copyfile(folder/name,alias/name)
        print('Verified firmware:',tag,len(data),digest)
    if manifest is None:raise ValueError('Latest firmware missing')
    serialized=json.dumps(manifest,indent=2)+chr(10)
    (dest/'latest.json').write_text(serialized,encoding='utf8')
    (ROOT/'firmware').mkdir(exist_ok=True);(ROOT/'firmware/latest.json').write_text(serialized,encoding='utf8')
if __name__=='__main__':main()

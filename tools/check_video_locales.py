"""Require matching content/timelines and independent media for each locale."""
import hashlib,json,re
from pathlib import Path
from bs4 import BeautifulSoup
root=Path(__file__).resolve().parents[1]
zh=root/'source/_static/web-tutorials'
en=root/'locales/en-media/source/_static/web-tutorials'
catalog=json.loads((zh/'catalog.json').read_text(encoding='utf8'))
english=json.loads((root/'tmp/locales/en/source/_static/web-tutorials/catalog.json').read_text(encoding='utf8'))
byid={x['id']:x for g in english for x in g['lessons']}
count=0
for group in catalog:
    if group['id'] in ('navigation','first-run','examples'):continue
    for lesson in group['lessons']:
        identity=lesson['id']
        if identity not in group['publishedLessons']:continue
        translated=byid[identity]
        assert lesson['duration']==translated['duration'],identity
        assert lesson.get('sourceLessons')==translated.get('sourceLessons'),identity
        assert [s['time'] for s in lesson['steps']]==[s['time'] for s in translated['steps']],identity
        for ext in ('webm','jpg','vtt'):
            a=(zh/(identity+'.'+ext)).read_bytes();b=(en/(identity+'.'+ext)).read_bytes()
            assert a!=b,(identity,ext,'English asset reuses Chinese bytes')
            for locale,expected in [('',b),('zh',a)]:
                assert (root/'tmp/site'/locale/'docs/_static/web-tutorials'/(identity+'.'+ext)).read_bytes()==expected
        assert re.findall(r'\d\d:\d\d:\d\d[.]\d{3}',(en/(identity+'.vtt')).read_text())==re.findall(r'\d\d:\d\d:\d\d[.]\d{3}',(zh/(identity+'.vtt')).read_text())
        assert not re.search('[一-鿿]',(en/(identity+'.vtt')).read_text(encoding='utf8'))
        count+=1
for prefix,lang,label in [('', 'en','English'),('zh','zh-CN','简体中文')]:
    for file in (root/'tmp/site'/prefix/'docs').glob('*.html'):
        soup=BeautifulSoup(file.read_text(encoding='utf8'),'html.parser')
        for track in soup.select('video track'):
            assert track['srclang']==lang and track['label']==label,(file,track)
assert (root/'tmp/site/mount-workflow.webm').read_bytes()!=(root/'tmp/site/zh/mount-workflow.webm').read_bytes()
print('PASS:',count,'paired tutorials and mounting video; locale media, captions and timelines')

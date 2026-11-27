"""Build English at the site root and Chinese under /zh with offline translations."""
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from bs4 import BeautifulSoup
from localization import ROOT, TEXT_SUFFIXES, translate, load_catalogue, HAN

WORK = ROOT/'tmp/locales/en'
OUTPUT = ROOT/'tmp/site'

def translated_name(name, mapping):
    return mapping.get(name, name)

def prepare_english():
    catalogue = load_catalogue()
    overrides = ROOT/'locales/en-overrides.json'
    if overrides.exists(): catalogue.update(json.loads(overrides.read_text(encoding='utf8')))
    catalogue.update(json.loads((ROOT/'locales/en-reviewed.json').read_text(encoding='utf8')))
    WORK.mkdir(parents=True, exist_ok=True)
    names = {p.name for d in ('site', 'source') for p in (ROOT/d).rglob('*') if HAN.search(p.name)}
    mapping = {name: 'reference-'+hashlib.sha256(name.encode()).hexdigest()[:12]+Path(name).suffix for name in names}
    for directory in ('site', 'source'):
        for source in (ROOT/directory).rglob('*'):
            if not source.is_file() or '__pycache__' in source.parts:continue
            relative = source.relative_to(ROOT)
            target = WORK.joinpath(*(mapping.get(part,part) for part in relative.parts))
            target.parent.mkdir(parents=True,exist_ok=True)
            authored = ROOT/'locales/en-pages'/relative
            if authored.is_file():
                shutil.copyfile(authored,target);continue
            # Downloads are authoritative byte-for-byte artifacts, not translated UI.
            if '_downloads' in relative.parts or ('_sdk' in relative.parts and source.suffix in ('.md','.json')):
                shutil.copyfile(source,target);continue
            if source.suffix not in TEXT_SUFFIXES:
                shutil.copyfile(source,target);continue
            try:text=source.read_text(encoding='utf-8-sig')
            except UnicodeDecodeError:shutil.copyfile(source,target);continue
            for old,new in mapping.items():text=text.replace(old,new)
            text=translate(text,catalogue,filename=str(relative))
            text=text.replace('zh-CN','en').replace('zh_CN','en')
            if source.name == 'web_tutorials.py':
                text=text.replace('label="Simplified Chinese"', 'label="English"')
            if source.suffix=='.rst':
                lines=text.splitlines()
                for i,line in enumerate(lines):
                    if i and re.fullmatch(r'[=~-]{3,}',line):lines[i]=line[0]*max(4,len(lines[i-1])+2)
                text='\n'.join(lines)+'\n'
            target.write_text(text,encoding='utf8')
    # These assets are photographed in English, not translated overlays on Chinese media.
    media=ROOT/'locales/en-media'
    if media.exists():shutil.copytree(media,WORK,dirs_exist_ok=True)
    script = WORK/'site/lessons.js'
    text = script.read_text(encoding='utf8')
    for name in ('mount-workflow.webm', 'mount-workflow-poster.png'):
        digest = hashlib.sha256((WORK/'site'/name).read_bytes()).hexdigest()[:12]
        text = re.sub(re.escape(name)+r'(?:[?]v=[a-f0-9]+)?', name+'?v='+digest, text)
    script.write_text(text, encoding='utf8')
    for path in (WORK/'site').glob('*.html'):
        text=path.read_text()
        def version(match):
            file=WORK/'site'/match[1]
            return match[1]+'?v='+hashlib.sha256(file.read_bytes()).hexdigest()[:12] if file.is_file() else match[0]
        text=re.sub(r'([A-Za-z0-9_.-]+\.(?:js|css))\?v=[0-9a-f]+',version,text)
        path.write_text(text)
    return WORK

def add_switch(path,locale):
    soup=BeautifulSoup(path.read_text(encoding='utf8'),'html.parser')
    if not soup.html or not soup.body:return
    soup.html['lang']='en' if locale=='en' else 'zh-CN'
    relative=path.relative_to(OUTPUT)
    page_parts=relative.parts if locale=='en' else relative.parts[1:]
    peer=Path('zh',*page_parts) if locale=='en' else Path(*page_parts)
    import os
    href=os.path.relpath(OUTPUT/peer,path.parent).replace('\\','/')
    nav=soup.new_tag('nav',attrs={'class':'locale-switch','aria-label':'Language' if locale=='en' else '语言'})
    nav['data-peer']=href
    for code,label in (('en','EN'),('zh','中文')):
        a=soup.new_tag('a',href=path.name if code==locale else href,hreflang='en' if code=='en' else 'zh-CN')
        a.string=label;a['lang']='en' if code=='en' else 'zh-CN'
        if code==locale:a['aria-current']='true'
        nav.append(a)
    host=soup.select_one('.neo-header-inner,header.nav')
    if host:host.append(nav)
    else:soup.body.insert(0,nav)
    for name in ('locale.css','locale.js'):
        url=os.path.relpath(OUTPUT/name,path.parent).replace('\\','/')
        tag=soup.new_tag('link',rel='stylesheet',href=url) if name.endswith('css') else soup.new_tag('script',src=url,defer='defer')
        soup.head.append(tag)
    for language,where in [('en',OUTPUT/Path(*page_parts)),('zh-CN',OUTPUT/Path('zh',*page_parts))]:
        url=os.path.relpath(where,path.parent).replace('\\','/')
        soup.head.append(soup.new_tag('link',rel='alternate',hreflang=language,href=url))
    path.write_text(str(soup),encoding='utf8')

def main():
    prepare_english()
    for source,dest,language in [(ROOT/'source',ROOT/'tmp/docs-zh','zh_CN'),(WORK/'source',ROOT/'tmp/docs-en','en')]:
        subprocess.run([sys.executable,'-m','sphinx','-E','-a','-b','html','-W','--keep-going','-D','language='+language,str(source),str(dest)],check=True)
    if OUTPUT.exists():
        assert OUTPUT.resolve()==ROOT/'tmp/site' and not OUTPUT.is_symlink()
        shutil.rmtree(OUTPUT)
    names=json.loads((ROOT/'site-manifest.json').read_text())
    for locale,source,docs,target in [('en',WORK/'site',ROOT/'tmp/docs-en',OUTPUT),('zh',ROOT/'site',ROOT/'tmp/docs-zh',OUTPUT/'zh')]:
        target.mkdir(parents=True,exist_ok=True)
        for name in names:shutil.copyfile(source/name,target/name)
        shutil.copytree(docs,target/'docs',ignore=shutil.ignore_patterns('.doctrees','.buildinfo','_sources','*.map'))
        for page in list(target.glob('*.html'))+list((target/'docs').glob('*.html')):add_switch(page,locale)
    for name in ('locale.css','locale.js'):shutil.copyfile(ROOT/'locales'/name,OUTPUT/name)
    (OUTPUT/'.nojekyll').touch()
    print('Built English default and Chinese /zh with page-preserving language links.')

if __name__=='__main__':main()

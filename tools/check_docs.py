"""Validate OpenAPI references, provenance, examples and generated local links."""
import ast
import hashlib
import json
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

root = Path(__file__).resolve().parents[1]
data = (root/'source/_downloads/http-api.openapi.json').read_bytes()
contract = json.loads(data)
provenance = json.loads((root/'source/_downloads/api-provenance.json').read_text())
assert hashlib.sha256(data).hexdigest() == provenance['sha256']
refs = 0
def walk(value):
    global refs
    if isinstance(value,dict):
        if '$ref' in value:
            ref = value['$ref']
            assert ref.startswith('#/'),ref
            target=contract
            for part in unquote(ref[2:]).split('/'):
                target=target[part.replace('~1','/').replace('~0','~')]
            refs+=1
        for item in value.values(): walk(item)
    elif isinstance(value,list):
        for item in value: walk(item)
walk(contract)
# Parse only executable example syntax; never send device commands.
text=(root/'source/api-guide.rst').read_text()
examples=0
lines=text.splitlines()
for i,line in enumerate(lines):
    if line.startswith('.. code-block:: '):
        language=line.split(':: ')[1]
        block=[]
        for following in lines[i+2:]:
            if following and not following.startswith('   '):break
            block.append(following[3:] if following.startswith('   ') else '')
        code='\n'.join(block).strip()
        if language=='python': ast.parse(code)
        elif language=='json': json.loads(code)
        examples+=1
class Links(HTMLParser):
    def __init__(self,text):
        super().__init__();self.links=[];self.ids=set();self.feed(text)
    def handle_starttag(self,tag,attrs):
        for key,value in attrs:
            if key in ('href','src') and value:self.links.append(value)
            if key=='id':self.ids.add(value)
build=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root/'tmp/docs'
pages={p.resolve():Links(p.read_text()) for p in build.glob('*.html')}
checked=0
for path,page in pages.items():
    for link in page.links:
        parsed=urlsplit(link)
        if parsed.scheme or parsed.netloc or not parsed.path and not parsed.fragment:continue
        target=(path.parent/unquote(parsed.path)).resolve() if parsed.path else path
        if target.is_dir():target=target/'index.html'
        assert target.exists(),(path.name,link)
        if parsed.fragment and target in pages:
            assert unquote(parsed.fragment) in pages[target].ids,(path.name,link)
        checked+=1
print(f'PASS: {refs} OpenAPI references, {examples} examples, {len(pages)} HTML pages, {checked} local links')

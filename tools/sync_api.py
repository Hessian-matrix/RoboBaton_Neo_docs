"""Copy the reviewed public OpenAPI contract and record its exact provenance."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('application', type=Path)
args = parser.parse_args()
application = args.application.resolve()
relative = 'docs/public_api/http-api.openapi.json'
data = (application / relative).read_bytes()
contract = json.loads(data)
commit = subprocess.check_output(['git', '-C', str(application), 'rev-parse', 'HEAD'], text=True).strip()
if subprocess.check_output(['git', '-C', str(application), 'status', '--porcelain', '--', relative], text=True).strip():
    raise SystemExit('OpenAPI source has uncommitted changes; freeze its provenance first')
dest = root / 'source/_downloads'
dest.mkdir(exist_ok=True)
(dest / 'http-api.openapi.json').write_bytes(data)
provenance = {'application_commit':commit,'source':relative,'sha256':hashlib.sha256(data).hexdigest(),'openapi':contract['openapi']}
(dest / 'api-provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
lines = ['接口契约与完整索引','==================','','本页根据应用公开版 OpenAPI 自动列举，逐字段类型、枚举、必填项、请求体和响应以契约为准。',
         '入门示例及流协议见 :doc:`api-guide`，各功能操作步骤见对应用户章节。','',
         ':download:`下载 OpenAPI 3.1 契约 <_downloads/http-api.openapi.json>`','',
         ':download:`下载来源与 SHA-256 <_downloads/api-provenance.json>`','',
         '下载后可在支持 OpenAPI 3.1 的编辑器中查看并生成客户端。生成器通常只能处理普通 HTTP 结构，',
         '二进制 RBH1/RBF2 流仍须实现相应解析器；不能把订阅响应作为单个 JSON。','',
         '应用来源提交：``'+commit+'``。','',
         'SHA-256：``'+provenance['sha256']+'``。','',
         '当前操作清单','------------','','.. list-table:: HTTP 方法、路径和操作标识','   :header-rows: 1','   :widths: 12 48 40','','   * - 方法','     - 路径','     - 操作标识']
count=0
for path, item in contract['paths'].items():
    for method, operation in item.items():
        if method not in ('get','post','put','patch','delete','head','options','trace'): continue
        count+=1
        public_path = path if path.startswith('/api/') else '/api' + path
        lines += ['   * - '+method.upper(),'     - ``'+public_path+'``','     - ``'+operation.get('operationId',method+' '+path)+'``']
lines += ['',f'共 {count} 个方法/路径操作，统计直接来自本页契约，不沿用历史报告中的数量。','',
          '使用契约前','----------','','* 先确认设备版本；本契约快照不会自动读取当前连接设备的能力。',
          '* GET 返回的只读字段不能未经筛选直接作为 POST 请求。',
          '* 命令受理、实际完成、持久保存和下次启动生效分别处理。',
          '* 示例用于说明结构，不能将示例标定数值当作设备真实参数。',
          '* 实时流开始后错误可能通过关闭连接体现，不能只检查最初的 HTTP 200。','']
(root / 'source/api-reference.rst').write_text('\n'.join(lines),encoding='utf-8')
print(f'Synchronized {count} operations from {commit}')

"""Keep the public update contract focused on client operations."""
import copy

def public_update_contract(contract):
    contract = copy.deepcopy(contract)
    description = contract.get('info', {}).get('description', '')
    prefix = description.partition('新增应用更新三操作')[0].partition('更新流程为上传校验、安装、显式重启。')[0]
    if '/update' in contract.get('paths', {}):
        contract['info']['description'] = prefix + '更新流程为上传校验、安装、显式重启。'
    for path, item in contract.get('paths', {}).items():
        if path not in ('/update', '/update/package', '/api/update', '/api/update/package'):
            continue
        for method, operation in item.items():
            if not isinstance(operation, dict):
                continue
            for status, response in operation.get('responses', {}).items():
                if status == '422':
                    response['description'] = '更新包校验失败，候选包不替换'
            if path.endswith('/package') and method == 'post':
                operation['description'] = ('固定 Content-Length 二进制上传，禁止 chunked/Expect。最大512MiB，还需实际可用空间。'
                    '单上传、单候选；空闲时接受，正文15秒无进展或总600秒超时。设备完成校验和保存后返回200，随后才可安装。'
                    '上传100%不代表校验通过。失败或残缺上传不可安装，已有候选保留；不提供续传。')
    schema = contract.get('components', {}).get('schemas', {}).get('UpdatePackageMetadata')
    if schema:
        fields = ('product', 'hardware', 'version', 'build_id', 'notes')
        schema['properties'] = {key: value for key, value in schema.get('properties', {}).items() if key in fields}
        schema['required'] = [key for key in schema.get('required', []) if key in fields]
        schema['additionalProperties'] = True
        schema['description'] = '只读更新包信息。本公开说明仅列出客户端展示字段；设备可能返回额外内部字段，客户端应忽略，不用于构造更新包。'
    return contract

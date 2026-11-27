"""Keep the public update contract focused on client operations."""
import copy
import re

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
    # Public descriptions explain observable behavior, not board implementation.
    replacements = {
        '/stream': '每连接选择一个通道。图像通道最多一个外部订阅，IMU 与里程计各最多四个。按 RBH1 解析，同连接 metadata 为准；源或配置变化后重新订阅。订阅不启动 VIO。传输为尽力输出，可能跳号或断线，不保证无损。灰度支持 5/30 fps；彩色可用帧率以 available_fps 为准。高于 5 fps 的彩色实际出帧后关闭独立预览，新预览返回 409 IMAGE_CONFLICT。',
        '/update': '查询固件更新状态。running 与 gateway_running 为实际运行版本，未知为 null；package 是候选包，operation 是最近更新操作。不返回 installed。',
    }
    for path,item in contract.get('paths',{}).items():
        public=path.removeprefix('/api')
        if public in replacements and 'get' in item:item['get']['description']=replacements[public]
    def clean(value):
        if isinstance(value,dict):
            for key,child in list(value.items()):
                if key=='description' and isinstance(child,str):
                    child=re.sub(r'默认持久化路径[^。]*。','',child)
                    child=re.sub(r'持久保存至 [^，；。]*[，；]','请求持久保存；',child)
                    child=child.replace('当前内核 usb0 地址','当前 USB 网络地址')
                    child=child.replace('临时文件写入、文件fsync、原子rename、目录fsync及回读完成后200','保存并回读确认后返回200')
                    value[key]=child
                else:clean(child)
        elif isinstance(value,list):
            for child in value:clean(child)
    clean(contract)
    return contract

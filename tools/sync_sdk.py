"""Synchronize only reviewed SDK client sources into the documentation snapshot."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SDK_FILES = (
    'CMakeLists.txt', 'README.md',
    'cpp/CMakeLists.txt', 'cpp/README.md', 'cpp/examples/odometry.cpp',
    'cpp/include/robobaton/client.hpp', 'cpp/src/client.cpp', 'cpp/examples/image.cpp',
    'python/README.md', 'python/pyproject.toml', 'python/examples/odometry.py', 'python/examples/image.py',
    'python/robobaton_sdk/__init__.py', 'python/robobaton_sdk/client.py',
    'python/robobaton_sdk/transport.py', 'python/robobaton_sdk/camera_model.py',
    'python/robobaton_sdk/ros_adapter.py', 'ros/README.md',
    'ros/ros1/robobaton_neo/CMakeLists.txt', 'ros/ros1/robobaton_neo/package.xml',
    'ros/ros1/robobaton_neo/scripts/neo_odometry.py',
    'ros/ros2/robobaton_neo/package.xml', 'ros/ros2/robobaton_neo/setup.cfg',
    'ros/ros2/robobaton_neo/setup.py', 'ros/ros2/robobaton_neo/resource/robobaton_neo',
    'ros/ros2/robobaton_neo/robobaton_neo/__init__.py',
    'ros/ros2/robobaton_neo/robobaton_neo/node.py',
    'stm32/README.md', 'stm32/neo_mavlink.c', 'stm32/neo_mavlink.h',
    'stm32/examples/neo_uart.c', 'stm32/examples/neo_uart.h',
    'tests/hal_stub/main.h', 'tests/test_rbh1.cpp', 'tests/test_sdk.py',
    'tests/test_serial.c', 'tests/test_uart.c',
)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('application', type=Path)
    args = parser.parse_args()
    application = args.application.resolve()
    selected = {'SDK/' + name: (application / 'SDK' / name).read_bytes() for name in SDK_FILES}
    api_names = ['README.md', 'HTTP-API.md', 'http-api.openapi.json',
                 'HTTP-API-MAVLink.md', 'HTTP-API-灰度.md', 'HTTP-API-错误码.md',
                 'HTTP-API-深度.md', 'HTTP-API-彩色.md', 'HTTP-API-标定参数.md',
                 'HTTP-API-安装补偿.md', 'HTTP-API-VIO状态与设备切换.md',
                 'HTTP-API-TF录制.md', 'HTTP-API-TF预检.md', 'HTTP-API-系统.md',
                 'HTTP-API-应用更新.md', 'HTTP-API-开机策略.md', 'HTTP-API-按键.md',
                 'HTTP-API-网络配置.md', 'HTTP-API-浏览器录制.md']
    for name in api_names:
        selected['docs/public_api/' + name] = (application / 'docs/public_api' / name).read_bytes()
    snapshot = ROOT / 'source/_sdk'
    if snapshot.exists():
        if snapshot.is_symlink() or snapshot.resolve() != ROOT / 'source/_sdk':
            raise ValueError('Unexpected SDK snapshot directory')
        shutil.rmtree(snapshot)
    for name, data in selected.items():
        path = snapshot / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    downloads = ROOT / 'source/_downloads'
    archive = downloads / 'robobaton-neo-sdk.zip'
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as output:
        for name, data in sorted(selected.items()):
            info = zipfile.ZipInfo(name, date_time=(2026, 11, 13, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            mode = 0o755 if name.endswith('/scripts/neo_odometry.py') else 0o644
            info.external_attr = (0o100000 | mode) << 16
            output.writestr(info, data)
    checksum = digest(archive.read_bytes())
    (downloads / 'robobaton-neo-sdk.sha256').write_text(checksum + '  ' + archive.name + '\n', encoding='utf-8')
    head = subprocess.check_output(['git', '-C', str(application), 'rev-parse', 'HEAD'], text=True).strip()
    status = subprocess.check_output(['git', '-C', str(application), 'status', '--porcelain', '--',
                                      'SDK', 'docs/public_api', 'tools/http-api'], text=True)
    provenance = {'source': 'cv-610-pub/SDK', 'snapshot_date': '2026-11-13',
                  'application_head': head, 'working_tree_modified': bool(status.strip()),
                  'archive': archive.name, 'sha256': checksum,
                  'files': {name: digest(data) for name, data in sorted(selected.items())},
                  'validation': 'Host tests only; ROS runtime and STM32 hardware not validated'}
    (downloads / 'sdk-provenance.json').write_text(json.dumps(provenance, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    spec = importlib.util.spec_from_file_location('sdk_quick_test_build', application / 'tools/http-api/build_quick_test.py')
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    code = builder.build()
    (ROOT / 'site/neo_quick_test.py').write_text(code, encoding='utf-8')
    (ROOT / 'source/_static/neo_quick_test.py').write_text(code, encoding='utf-8')
    examples_path = ROOT / 'site/integration-examples.json'
    examples = json.loads(examples_path.read_text(encoding='utf-8'))
    examples['quick_test'] = code
    examples.pop('standalone_python', None)
    examples_path.write_text(json.dumps(examples, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    package = ROOT / 'site/neo-http-python.zip'
    with zipfile.ZipFile(package, 'w', compression=zipfile.ZIP_DEFLATED) as output:
        for name in ('client.py', 'transport.py', 'camera_model.py'):
            output.writestr(name, selected['SDK/python/robobaton_sdk/' + name])
        for target, source in (('quick_test.py', 'quick_test.py'), ('README.md', 'QUICK-TEST-README.md'),
                               ('AI-PROMPT.md', 'AI-PROMPT.md')):
            output.writestr(target, (application / 'tools/http-api' / source).read_bytes())
    (ROOT / 'site/neo-http-python.sha256').write_text(digest(package.read_bytes()) + '  ' + package.name + '\n', encoding='utf-8')
    print('Synchronized %d SDK/API files; SHA256 %s; working_tree_modified=%s' %
          (len(selected), checksum, provenance['working_tree_modified']))


if __name__ == '__main__':
    main()

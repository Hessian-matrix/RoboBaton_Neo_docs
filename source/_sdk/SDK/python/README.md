# Python 示例

Python 3.8+，核心客户端仅依赖标准库。SDK 可单独复制使用，不依赖仓库其他目录。

~~~sh
python3 -m pip install -e SDK/python
python3 SDK/python/examples/odometry.py http://192.168.11.1 --messages 10
python3 SDK/python/examples/odometry.py http://192.168.11.1 --channel imu
~~~

也可不安装：在仓库根目录设置 PYTHONPATH=SDK/python 后执行示例。只读订阅不会启动 VIO；输出 null 表示当前不可用，不是零位姿。连接错误直接退出，由用户决定何时新开会话。

~~~python
from robobaton_sdk import Device

stream = Device('http://192.168.11.1').observe(['odometry'])
try:
    for name, fmt, sequence, message in stream:
        if name == 'odometry':
            print(message['header'], message['pose'], message['twist'])
finally:
    stream.close()
~~~

## 保存图像

~~~sh
mkdir -p tmp/neo-images
python3 SDK/python/examples/image.py http://192.168.11.1 tmp/neo-images --messages 10
~~~

使用 gray_jpeg（544×640 mono8、质量90、源帧率模式），每帧保存 JPEG 和同名 JSON；已有文件拒绝覆盖。JSON 保留设备 header、编码字段和配置，文件名采用 RBH1 消息序号。提前 EOF 或协议错误报错。JPEG 字节未完整解码，不保证固定频率；与位姿独立连接，不自动配对。时间为设备单调时间或 null，不是 UTC。

observe 每连接只选一个通道：odometry、imu、preview、color、gray、gray_jpeg、depth。图像 data 是二进制；含时间及像素配置，具体布局遵从公开 API。Device 同时保留原公开管理方法，写操作并非订阅示例的一部分；调用前阅读接口的幂等键及并发规则。

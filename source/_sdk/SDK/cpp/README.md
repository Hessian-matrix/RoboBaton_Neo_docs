# C++17 HTTP 示例

依赖 libcurl、json-c、pkg-config、CMake 3.16+。Linux / WSL：

~~~sh
sudo apt-get install build-essential cmake pkg-config libcurl4-openssl-dev libjson-c-dev
cmake -S SDK -B tmp/sdk-build
cmake --build tmp/sdk-build
./tmp/sdk-build/cpp/neo_odometry http://192.168.11.1 10
~~~

客户端支持公开 odometry 和 gray_jpeg，分别使用独立连接。位姿订阅，检查 Content-Type、metadata 和 RBH1 分片，输出原 JSON，保留 null 和 uint64 字符串。业务字段以公开 HTTP 文档为准；复用时可用 json-c 提取具名 pose/twist 字段，不将缺失数据填零。

库入口 robobaton::observe_odometry(origin, callback)，callback 返回 false 即释放连接。支持 HTTP/HTTPS 源站地址和端口；不跟随重定向，不携带账号，不自动重连；10 秒连接期限，连续低速 30 秒退出。需要应用级停止时可在回调返回 false；没有业务数据时退出可能等待低速超时。

libcurl 负责 HTTP chunk 解码，Decoder 只处理 RBH1；最多 16 MiB 在途消息、单消息 2 MiB+8208、单片 65536、JSON 128 KiB，拒绝乱序/截断/重复帧。Decoder 对象在协议异常后应丢弃，创建新对象处理新连接。

## 获取灰度图像

~~~sh
mkdir -p tmp/neo-images
./tmp/sdk-build/cpp/neo_image http://192.168.11.1 tmp/neo-images 10
~~~

库入口 robobaton::observe_gray_jpeg(origin, callback)，回调接收 JpegFrame：data 为原 JPEG 字节，metadata_json 保留源 header/pts_us/random_access，config_json 保留图像配置，sequence 是 RBH1 消息序号，source_sequence 是设备图像序号。返回 false 关闭连接。示例保存 JPEG 和同名 JSON，拒绝覆盖已有文件；提前 EOF 报错。

现有通道输出 544×640、mono8、quality=90、源帧率模式灰度 JPEG，不修改设备配置，不保证固定帧率。SDK 校验配置、长度、字段、序号和 JPEG 首尾标记，不进行完整像素解码；显示或获取像素矩阵时交给应用的 JPEG 解码库。设备 stamp 可以为 null，否则是单调时间，不是 UTC。图像与位姿独立订阅，不是同步配对；图像光学系 X向右/Y向下/Z向前，与 IMU 系不同，外参必须使用实际标定。

主机回归还包含分片交织和真实 HTTP chunked 模拟服务；不表示已经连接真实设备。

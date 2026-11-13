C++ SDK
========

.. container:: doc-lead

   使用 C++17 客户端接收公开 HTTP 里程计与灰度 JPEG 图像，保留原 JSON 字段、null 和序号字符串。

准备与构建
----------

先从 :doc:`sdk` 下载并解压，在包含 SDK/ 的目录执行。
Linux / WSL 依赖 CMake 3.16+、C++17 编译器、pkg-config、libcurl 和 json-c：

.. code-block:: bash

   sudo apt-get install build-essential cmake pkg-config libcurl4-openssl-dev libjson-c-dev
   cmake -S SDK -B tmp/sdk-build
   cmake --build tmp/sdk-build
   ./tmp/sdk-build/cpp/neo_odometry http://192.168.11.1 10

SDK 顶层回归同时使用 C 编译器和 Python 3。Windows 原生构建需自行配置相同依赖，
本次命令验证范围是 Linux / WSL，不把 WSL 示例当作已验证的 Windows 安装包。

完整接收示例
------------

.. literalinclude:: _sdk/SDK/cpp/examples/odometry.cpp
   :language: cpp
   :caption: 直接来自 SDK/cpp/examples/odometry.cpp

库入口为 robobaton::observe_odometry(origin, callback)。callback 收到一条原始业务 JSON，
返回 false 即释放连接。可用 json-c 提取 pose.position、pose.orientation 和 twist；
不要按字符串位置拆字段或把 uint64 序号转成 double。参考点和时间规则见 :doc:`sdk`。

获取与保存图像
--------------

在上述构建后，创建空输出目录并接收 10 帧：

.. code-block:: bash

   mkdir -p tmp/neo-images
   ./tmp/sdk-build/cpp/neo_image http://192.168.11.1 tmp/neo-images 10

每帧保存一个 JPEG 和同名 JSON，保留原始 header/pts_us/random_access 及配置；
文件名是 RBH1 消息序号，设备图像序号保留在 JSON header.seq。已有文件不会覆盖。

.. literalinclude:: _sdk/SDK/cpp/examples/image.cpp
   :language: cpp
   :caption: 直接来自 SDK/cpp/examples/image.cpp

库入口 robobaton::observe_gray_jpeg(origin, callback)，回调的 JpegFrame.data 是 JPEG 字节，
metadata_json 和 config_json 是原始帧元数据及配置；sequence 为 RBH1 消息序号，
source_sequence 为设备图像序号。返回 false 释放连接，不需要 OpenCV。
如需像素矩阵或窗口显示，再交给应用的 JPEG 解码库。

现有 gray_jpeg 为 544×640 mono8、质量 90、源帧率模式；不承诺固定帧率。
SDK 校验元数据、长度、序号、JPEG 首尾标记，不等同完整 JPEG 解码。
图像 stamp 为设备单调时间或 null，不是 UTC；图像与位姿使用独立连接，不是同步配对。
图像光学坐标 X向右/Y向下/Z向前，与 IMU 系的转换须使用实际标定外参。

接收与错误边界
--------------

* 分别订阅 odometry 或 gray_jpeg，不启动/停止 VIO。先在设备页面完成初始化。
* libcurl 处理 HTTP chunk，SDK 验证 HTTP 状态、Content-Type、metadata 及 RBH1 分片。
* 支持 HTTP/HTTPS 源站和端口，不跟随重定向，不自动重连；10 秒连接期限，连续低速 30 秒退出。
* 回调返回 false 主动停止；没有业务数据时退出可能等待低速超时。EOF、截断或协议错误报错，不复用旧轨迹。
* SDK 的 JSON/传输检查不等于下游业务质量验收。null 数据不能补零，序号、时间回退和设备重启由上层管理新会话。

主机测试覆盖分片交织和本机 HTTP chunked 模拟服务，不代表真实板端长期负载验收。

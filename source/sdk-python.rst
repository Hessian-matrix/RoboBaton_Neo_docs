Python SDK
==========

.. container:: doc-lead

   安装统一 robobaton_sdk，直接订阅公开 HTTP，不复制 RBH1 解析实现。

获取与运行
----------

先在 :doc:`sdk` 下载并解压 SDK，在包含 SDK/ 的目录使用 Python 3.8+：

.. code-block:: bash

   python3 -m pip install -e SDK/python
   python3 SDK/python/examples/odometry.py http://192.168.11.1 --messages 10
   python3 SDK/python/examples/odometry.py http://192.168.11.1 --channel imu

Windows 可将 python3 替换为 py -3。核心客户端仅依赖标准库；不安装时可把 SDK/python
加入 PYTHONPATH，再运行同一示例。系统禁止全局 pip 安装时使用自己的虚拟环境，不强制修改系统 Python。

接入自己的程序
--------------

.. literalinclude:: _sdk/SDK/python/robobaton_sdk/__init__.py
   :language: python
   :caption: SDK 包公开入口，直接来自本次源码快照

.. code-block:: python

   from robobaton_sdk import Device

   stream = Device('http://192.168.11.1').observe(['odometry'])
   try:
       for name, fmt, sequence, message in stream:
           if name == 'odometry':
               print(message['header'], message['pose'], message['twist'])
   finally:
       stream.close()

每个连接只选择一个通道：odometry、imu、preview、color、gray、gray_jpeg 或 depth。
同时需要多个通道时分别创建连接，不把到达顺序当同步关系。图像 data 是二进制，不直接按 JSON 打印像素。
Device 也保留公开管理方法；本页接收示例不调用写接口，写操作应另读 :doc:`api-guide` 的幂等和并发规则。

完整位姿 / IMU 示例
-------------------

.. literalinclude:: _sdk/SDK/python/examples/odometry.py
   :language: python
   :caption: 直接来自 SDK/python/examples/odometry.py

获取与保存图像
--------------

.. code-block:: bash

   mkdir -p tmp/neo-images
   python3 SDK/python/examples/image.py http://192.168.11.1 tmp/neo-images --messages 10

.. literalinclude:: _sdk/SDK/python/examples/image.py
   :language: python
   :caption: 直接来自 SDK/python/examples/image.py

每帧保存 JPEG 与同名 JSON，拒绝覆盖已有文件；文件名采用 RBH1 消息序号。
JSON 保留原设备 header 与配置。gray_jpeg 为 544×640 mono8、质量90、源帧率模式，
不承诺固定频率。此示例不完整解码 JPEG；位姿与图像独立连接，不自动同步配对。
设备时间为开机单调时间或 null，不是 UTC；相机光学系不同于 IMU 系。

输出与失败处理
--------------

默认收 10 条业务消息，control 元数据不计数。null 位姿仍原样输出，不代表有效定位；
若想收齐有效位姿与图像，使用 :doc:`api-examples` 的快速验证。
连接错误、协议错误或未收够消息就结束会退出，不自动重连；finally 释放订阅。
时间、坐标和空值约定见 :doc:`sdk`。收到数据不代表标定精度通过。

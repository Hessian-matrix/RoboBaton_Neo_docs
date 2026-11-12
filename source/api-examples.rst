获取位姿与图像：多语言示例
==========================

交互式引导：`接入你的程序 <../integration.html>`_。

完成 VIO 启动与初始化后，再接收数据。订阅不会启动算法，断开也不会停止算法。
位姿与图像分别使用独立 HTTP 连接。本页提供 Python 和 JavaScript（Node.js）两个版本。

准备工作
--------

示例复用与设备固件配套的 cv-610-pub 应用源码中的公开客户端，包含 RBH1 分片重组、
元数据与图像封装解析。需要先取得该应用源码，在仓库根目录创建并运行下方脚本。
这不是无需依赖的独立 SDK。示例不自动修改配置、不自动启动 VIO。

设备地址使用 http://192.168.11.1，也支持 http://192.168.46.1:46002。
运行前建立一个空目录作为工作副本或确认当前目录没有需保留的 neo-latest.jpg，
示例会反复覆盖该文件，只保留最新收到的灰度 JPEG 图像。

.. _api-python:

Python 3
--------

仅依赖 Python 标准库及应用 tools/http-api 下的客户端模块。
将以下代码保存为 receive.py，放在应用仓库根目录。

.. code-block:: python

   import sys
   from pathlib import Path
   sys.path.insert(0, str(Path(__file__).resolve().parent / 'tools/http-api'))
   from client import Device

   origin = sys.argv[1] if len(sys.argv) > 1 else 'http://192.168.11.1'
   channel = sys.argv[2] if len(sys.argv) > 2 else 'odometry'
   if channel not in ('odometry', 'gray_jpeg'):
       raise ValueError('Choose odometry or gray_jpeg')
   stream = Device(origin).observe([channel])
   count = 0
   try:
       for name, fmt, sequence, data in stream:
           if name == 'control':
               continue
           if name == 'odometry':
               print(data['header'], data['pose'], flush=True)
           else:
               Path('neo-latest.jpg').write_bytes(data['data'])
               print(data['header'], 'saved neo-latest.jpg', flush=True)
           count += 1
           if count >= 10:
               break
   finally:
       stream.close()

分别运行下列命令；同时获取位姿与图像时使用两个终端：

.. code-block:: bash

   python receive.py http://192.168.11.1 odometry
   python receive.py http://192.168.11.1 gray_jpeg

每个进程接收 10 条业务消息后退出。无位姿或断流时检查初始化和网络状态，再重新运行。

.. _api-javascript:

JavaScript（Node.js）
--------------------------------

需要 Node.js 18 或更新版本，使用应用自带公开流解析模块，无需安装 npm 包。
将以下代码保存为 receive.cjs，放在应用仓库根目录。
这是电脑端 Node.js 程序，不是在公网产品站中执行的浏览器脚本。

.. code-block:: javascript

   const fs = require('node:fs');
   const {open} = require('./calibration/calibration-js/browser/public/http-stream.js');
   const origin = process.argv[2] || 'http://192.168.11.1';
   const channel = process.argv[3] || 'odometry';
   if (!['odometry', 'gray_jpeg'].includes(channel)) throw Error('Invalid channel');
   const stream = open(origin, [channel]);
   let count = 0;
   stream.onmessage = event => {
     if (channel === 'odometry') {
       const data = JSON.parse(new TextDecoder().decode(event.data));
       console.log(data.header, data.pose);
     } else {
       fs.writeFileSync('neo-latest.jpg', event.frame.data);
       console.log(event.frame.header, 'saved neo-latest.jpg');
     }
     if (++count >= 10) stream.close();
   };
   stream.onerror = error => { console.error(error); process.exitCode = 1; };
   process.on('SIGINT', () => stream.close());

.. code-block:: bash

   node receive.cjs http://192.168.46.1:46002 odometry
   node receive.cjs http://192.168.46.1:46002 gray_jpeg

数据含义与限制
--------------

位姿使用 GET /api/stream?channels=odometry，图像使用 GET /api/stream?channels=gray_jpeg。
每条连接只能选择一个通道。灰度 JPEG 便于入门；彩色及其他图像通道见 :doc:`imaging`。
不能把 HTTP 数据流直接当作 JSON 或完整 JPEG，需要先解析 RBH1 并重组业务消息。

pose.position 是 x/y/z，单位米；pose.orientation 是具名 x/y/z/w 单位四元数。
位姿可能为空，不能替换为零；结合 tracking 状态判断有效性。
header.seq 是十进制字符串，Python 用 int、JavaScript 用 BigInt 处理，不能先转换为浮点数。
header.stamp 是设备单调时钟，不是电脑时间。位姿与图像异步到达，需按有效时间戳关联。

HTTP 位姿以 IMU 为参考，串口输出已应用安装补偿，不能直接当作同一参考点。
完整字段与重连规则见 :doc:`api-guide`、:doc:`api-reference` 和 :doc:`positioning`。
代码检查及模拟数据验证不代表当前固件实机验收。

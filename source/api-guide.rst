HTTP API 接入
=============

外部程序优先使用 :doc:`sdk` 中的 C++ / Python 客户端；ROS / ROS 2 复用同一 Python SDK。
本页用于解释 HTTP 契约，不要求为每种语言重新实现协议。STM32 UART 见 :doc:`sdk-stm32`。

地址与请求约定
--------------

设备网页与 API 共用 HTTP/1.1 的 80 端口，默认基础地址为
``http://192.168.11.1``，当前接口前缀统一为 ``/api``。
不要使用历史带版本号路径，也不要根据旧测试报告推断存在兼容别名。

接口分三类：普通 JSON 查询、配置/命令写入、长连接二进制数据流。
完整操作清单、字段类型和错误响应见 :doc:`api-reference`。

查询通常不需要正文。JSON 写入使用 ``Content-Type: application/json``
和明确的 ``Content-Length``；不使用 chunked 请求正文。
不同接口的字段和正文上限不同，禁止向配置对象随意加入自定义字段。
响应通常是直接对象，没有通用的 ``data`` 或 ``ok`` 包装。

先做只读连接检查
----------------

以下示例使用 Python 3 标准库，不要求第三方包：

.. code-block:: python

   import json
   import urllib.request

   base = 'http://192.168.11.1'
   with urllib.request.urlopen(base + '/api/vio', timeout=5) as response:
       status = json.load(response)
   print(status)

运行中的一种成功响应：

.. code-block:: json

   {"state":"running","tracking":"valid","error":null,"warning":null}

这是结构示例，不是当前设备的真实状态。running 只说明进程存在；
tracking、warning 和数据新鲜度需分别判断。

命令受理、状态确认与重试
------------------------

VIO 启停等命令需要 ``Idempotency-Key``。同一次业务尝试使用同一个键，
不同操作使用不同键。不能把每次网络重试都换成新键，否则可能创建重复操作。
各模块去重记录的寿命不同，不能假设所有键永久保存。

启动 VIO 的示例会真实改变设备状态，请在准备好运行时执行：

.. code-block:: python

   import json
   import uuid
   import urllib.error
   import urllib.request

   base = 'http://192.168.11.1'
   request_key = str(uuid.uuid4())  # 保存该键供受控重试使用
   body = json.dumps({'action': 'start'}).encode('utf-8')
   request = urllib.request.Request(
       base + '/api/vio', data=body, method='POST',
       headers={
           'Content-Type': 'application/json',
           'Content-Length': str(len(body)),
           'Idempotency-Key': request_key,
       },
   )
   try:
       with urllib.request.urlopen(request, timeout=5) as response:
           print(response.status, json.load(response))
   except urllib.error.HTTPError as error:
       print(error.code, error.read().decode('utf-8', errors='replace'))
   # 202 仅表示受理，后续 GET /api/vio 核对真实状态；超时先查询。

典型受理返回 202，以及 action=start、accepted=true。
配置保存可能同步返回 200，例如安装补偿，因此不能把所有 POST 按同一种异步模型处理。

配置对象往往是完整替换，不是 PATCH。先读取、只保留可写字段、修改后完整提交，
再独立回读。source、configured、尺寸或上限等只读字段不能直接随读取结果全部写回。
以各请求 schema 为准。

处理错误
--------

失败常见结构为：

.. code-block:: json

   {"error":{"code":"COMMAND_BUSY"}}

错误对象不提供通用 message 或 description。OpenAPI 中 description 是文档说明，
不是返回字段；图像流的 descriptor 则是实际解码配置，两者不同。

.. list-table:: 常用 HTTP 状态处理
   :header-rows: 1

   * - 状态
     - 建议
   * - 400
     - 校对字段、类型、路径及请求头，不原样循环重试
   * - 409
     - 查占用、配置冲突、幂等键或重启状态，条件满足后再操作
   * - 422
     - 包或内容校验失败，按模块错误码检查
   * - 429
     - 释放多余数据流连接
   * - 500 / 503
     - 区分服务不可用与保存结果未确认，写入失败先回读
   * - 507
     - 检查存储空间，备份后再清理明确的数据

MAVLink 异步操作、录制结束原因等还可能使用独立的原因码字段。
保留未知错误码，不因客户端没有本地翻译就将其当作成功。

实时流不是普通 JSON 响应
------------------------

请求例：``GET /api/stream?channels=imu`` 或
``GET /api/stream?channels=odometry``。每条连接只选择一个通道。

Content-Type 为 ``application/vnd.robobaton.stream``。HTTP 库先去除 chunked 传输层，
再解析 RBH1。一次 TCP read、一个 HTTP chunk、一个 RBH1 分片和一条业务消息是不同边界。
不能对整条响应调用 json.load，也不能把每次收到的字节直接当成完整图像。

RBH1 固定 40 字节小端头：

.. list-table:: RBH1 帧头
   :header-rows: 1
   :widths: 15 15 70

   * - 偏移
     - 字节数
     - 内容
   * - 0
     - 4
     - ASCII RBH1
   * - 4
     - 2
     - 封装版本 1
   * - 6
     - 2
     - 头长 40
   * - 8
     - 2
     - channel，0 控制，1–7 对应公开通道
   * - 10
     - 2
     - format，决定完整消息的负载解析方式
   * - 12
     - 4
     - flags，bit0 FIRST、bit1 LAST，其他为 0
   * - 16
     - 8
     - 连接内该 channel 的传输序号
   * - 24
     - 4
     - 完整消息字节数
   * - 28
     - 4
     - 当前分片偏移
   * - 32
     - 4
     - 分片字节数，1–65536
   * - 36
     - 4
     - 保留，必须为 0

按通道与传输序号重组，检查长度上限、连续偏移、FIRST/LAST 与总长度一致性。
完整消息验证后再解码，断线时丢弃半条消息。共享解析上限为
``2 MiB + 8208`` 字节/消息，JSON 上限 128 KiB；具体通道上限可能更小。

.. list-table:: 通道与负载
   :header-rows: 1

   * - 通道名
     - channel / format
     - 完整消息
   * - 控制
     - 0 / 1
     - metadata、心跳等 JSON
   * - preview
     - 1 / 6
     - RBF2 描述依赖及图像封装，不是裸视频流
   * - odometry
     - 2 / 1
     - 单条里程计 JSON
   * - imu
     - 3 / 1
     - 单个 IMU 样本 JSON，不是 samples 数组
   * - color
     - 4 / 7
     - 小端 uint32 JSON 长度、JSON 帧信息、编码图像
   * - gray
     - 5 / 8
     - 小端 uint32 JSON 长度、JSON 帧信息、348160 字节 mono8
   * - gray_jpeg
     - 6 / 7
     - 小端 uint32 JSON 长度、JSON 帧信息、JPEG
   * - depth
     - 7 / 9
     - 小端 uint32 JSON 长度、JSON 帧信息、589824 字节 float32 LE

先处理连接 metadata。重新连接、编码变化或源重启时重新建立配置与解码状态，
不要拿上一次 GET 的配置替代该连接实际 metadata。H.264/H.265 从携带参数集的实际 IDR 恢复，
普通 I 帧不一定满足本接口随机访问要求。

时间、序号与坐标
----------------

业务 header.seq 是十进制字符串，和 RBH1 的连接传输序号不同。
JavaScript 用 BigInt，Python 用 int，不能先转换成浮点数再做完整性判断。
stamp.sec 与 stamp.nanosec 组合为设备本次启动的单调时钟纳秒，
不是 Unix 时间、UTC 或网络到达时间，不能直接跨设备比较。

时间无效时可以为 null，不能补一个电脑时间冒充同步。
HTTP IMU 与里程计坐标以及安装补偿的差异见 :doc:`positioning` 和 :doc:`mounting-flight-controller`。

订阅与算法生命周期
------------------

订阅里程计不会启动算法，关闭订阅不会停止算法。
无算法时可能仍有传输心跳，心跳只能说明连接活着。
IMU、图像和深度按自身订阅需求管理资源，取消自己的连接不应关闭其他消费者。

客户端应设置有界缓冲和超时。实时观看断线可以重连并重新读取 metadata，
严谨录制则必须记录断点或不完整状态，不把两段断开的流悄悄拼成连续采集。

跨域与联网范围
--------------

设备网页优先使用设备自身地址，主控程序直接连接设备 USB 网络。
不要假设公网 HTTPS 网站可以任意读取本地 HTTP API，也不要为了绕过浏览器限制
将设备控制接口直接暴露到公网。本站没有承诺额外的登录、TLS 或跨域授权机制。

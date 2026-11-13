统一 SDK 接入
=============

.. container:: doc-lead

   外部程序接入统一以 SDK 为基准。按运行环境选择示例，不再从旧工具目录复制协议实现。

.. container:: doc-facts

   **来源** 应用仓库 SDK/　　**连接** USB 网络 HTTP 或 UART　　**默认行为** 只读订阅

下载与选择
----------

:download:`下载完整 SDK <_downloads/robobaton-neo-sdk.zip>` ·
:download:`下载 SHA-256 <_downloads/robobaton-neo-sdk.sha256>` ·
:download:`查看源码清单与逐文件校验值 <_downloads/sdk-provenance.json>`

解压后进入包含 SDK/ 的目录执行下文命令。下载包来自本次本地 SDK 源码快照，
清单分别记录应用 HEAD 与工作区差异，不把尚未提交的源码冒充已发布固件。
它是应用客户端 SDK，与用于内核、系统镜像和交叉工具链的板级 SDK 不同。

:doc:`sdk-cpp` · C++17
   HTTP 位姿及灰度 JPEG 接收/保存，依赖 libcurl 和 json-c。

:doc:`sdk-python` · Python 3.8+
   HTTP 位姿、IMU 与灰度 JPEG 保存示例；客户端还支持其他公开通道。
   先体验可使用 :doc:`api-examples`，无需安装 SDK。

:doc:`ros` · ROS 1
   独立 catkin 示例包，发布里程计、压缩图像与原始源时间。

:doc:`ros2` · ROS 2
   独立 ament_python 示例包，发布里程计、压缩图像与原始源时间。

:doc:`sdk-stm32` · STM32
   C99 MAVLink 2 解码器与 Cube HAL 接收适配。

连接之前
--------

1. USB 接电脑时使用网络 HTTP，不把它当作 USB 串口。默认地址为 http://192.168.11.1。
2. 在设备网页启动 VIO 并完成初始化。订阅不会启动算法，断开也不会停止算法。
3. UART 接收先核对 3.3 V TTL、TX/RX、共地、独立供电和双方波特率。
4. 只读示例不改配置、不刷固件、不自动重连拼接轨迹。断流或设备重启后明确开启新会话。

坐标、时间与空值
----------------

HTTP 位姿参考点固定为 IMU 原点。世界系右手、Z 向上，初始航向不是地理北；
姿态是 world_from_imu，具名 x/y/z/w，线速度与角速度在 IMU 系表达。
把 frame 改名为 base_link 并不会得到机器人中心或 FLU 坐标。

UART 数据已经过安装补偿和原点/航向对齐，四元数为 w/x/y/z，
按 frame_id / child_frame_id 解释，不能直接当作 HTTP 原始 IMU 位姿。

HTTP 时间来自设备 CLOCK_MONOTONIC_RAW，不是 UTC。序号保留 uint64 十进制字符串，
不得经浮点数转换。null 位姿、速度或时间表示不可用，不能补成零。
ROS 示例使用主机发布时刻，另发原始设备 header；需要精确融合时先完成时钟同步。

目录与验证边界
--------------

.. code-block:: text

   SDK/
     cpp/       C++ 客户端与位姿/图像示例
     python/    robobaton_sdk 包及位姿/IMU/图像示例
     ros/       ROS 1 与 ROS 2 示例包
     stm32/     C99 解析器与 HAL 适配
     tests/     主机协议和适配回归

Python 协议唯一源码在 SDK/python/robobaton_sdk；应用仓库 tools/http-api 同名模块只作旧路径兼容。
SDK 不进入设备网页包，不增加设备接口或内部功能。
下载包同时带公开 API 文档供查字段，网页索引见 :doc:`api-reference`。

下载包可独立编译和运行主机回归；需要应用仓库旧客户端/单文件生成器的两项测试会明确跳过，
生产编码器联测也只在应用仓库存在时启用，不把这些跳过项算作下载包验收通过。

2026-11-13 主机验证覆盖四组 SDK 回归、22 项 Python 集成测试、C++ HTTP、
生产 MAVLink 编码器到 HAL 桩的联测和协议解析 ASan/UBSan（不含泄漏检查）。
这不代表已经完成真实设备、ROS 构建/DDS、STM32 接线/IRQ 或飞控融合验收。

.. container:: doc-next

   按语言继续 :doc:`sdk-python` 或 :doc:`sdk-cpp`；嵌入式接入见 :doc:`sdk-stm32`。

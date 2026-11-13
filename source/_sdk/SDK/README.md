# RoboBaton Neo 外部接入 SDK

本目录是后续外部程序接入的统一基准。它是应用客户端 SDK，不是构建系统镜像的外部板级 SDK，不包含内核、驱动副本或内部页面。

| 环境 | 入口 | 数据来源 |
| --- | --- | --- |
| Python 3 | [python](python/README.md) | 公开 HTTP / RBH1 |
| C++17 | [cpp](cpp/README.md) | 公开 HTTP / RBH1 |
| ROS 1 / ROS 2 | [ros](ros/README.md) | 共用 Python SDK → nav_msgs/Odometry + sensor_msgs/CompressedImage |
| STM32 / C99 | [stm32](stm32/README.md) | UART / MAVLink 2 ODOMETRY |

## 统一约定

- 默认设备地址为 http://192.168.11.1；USB 是网络传输，不是 USB 串口。
- HTTP 使用固定 IMU 原点、局部右手 Z 向上世界系；四元数为 world_from_imu，具名 x/y/z/w；速度在 IMU 系表达，不自动转换机器人 FLU。
- HTTP 时间是设备 CLOCK_MONOTONIC_RAW，不是 UTC；未经同步不得作为 ROS 系统时间。序号是 uint64 十进制字符串。null 位姿/速度/时间不得补成零。
- 串口参考点已经过安装补偿和原点/航向对齐，按 frame_id/child_frame_id 解释，不能当作 HTTP 原始 IMU 位姿。
- 示例只订阅，不启动/停止 VIO、不写配置、不自动重连续接轨迹。先在设备网页完成配置并启动 VIO；断流、重启及时间回退应由上层明确开启新会话。
- 字段、单位、错误和订阅生命周期以[公开接口](../docs/public_api/README.md)、[HTTP 总览](../docs/public_api/HTTP-API.md)、[串口说明](../docs/public_api/HTTP-API-MAVLink.md)为准。
- Python 协议实现以 SDK/python/robobaton_sdk 为唯一源码；tools/http-api 仅保留旧路径兼容入口。未来接入示例优先复用 SDK，不再复制协议实现。

## 主机回归

在仓库根目录执行，所有构建产物保存在 tmp：


依赖：Python 3、CMake、C/C++ 编译器、libcurl、json-c。

~~~sh
python3 SDK/tests/test_sdk.py
cmake -S SDK -B tmp/sdk-build
cmake --build tmp/sdk-build
(cd tmp/sdk-build && ctest --output-on-failure)
~~~

SDK 不进入板端网页包，不修改设备协议或行为。主机模拟测试不代表 ROS 环境、STM32 HAL 或真实设备验收。

本次主机验证范围及限制见 release/sdk/README.md；测试结果归档在 release/sdk，构建和临时文件在 tmp。

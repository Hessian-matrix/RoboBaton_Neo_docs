# 公开版 API 文档

本目录只收录当前公开版 HTTP API 的接口规范、字段说明、错误码与 OpenAPI 契约。历史验证报告、板内 IPC/驱动协议和其他模块文档保留在原目录；它们不是当前对外接口清单。

当前接口统一使用 /api 前缀，网页与接口共用 HTTP/1.1 的 80 端口。带版本号的旧地址不提供兼容别名。

## 入口

- [统一外部接入 SDK](../../SDK/README.md)：C++、Python、ROS / ROS 2、STM32 串口示例；不新增设备接口。
- [HTTP API 总览](HTTP-API.md)：全部方法与路径、预览、IMU、里程计及 RBH1 封装。
- [OpenAPI 3.1](http-api.openapi.json)：请求、响应、字段类型、枚举及错误响应。
- [错误码](HTTP-API-错误码.md)：错误含义和处理方式。
- [Python 主控示例](../../tools/http-api/README.md)：配置、命令、实时流和录制读取。

## 按功能查阅

| 功能 | 接口说明 |
| --- | --- |
| VIO | [启停、状态与设备切换](HTTP-API-VIO状态与设备切换.md)；里程计见总览 |
| 图像 | [彩色配置及编码流](HTTP-API-彩色.md)、[原始灰度与 JPEG Q90](HTTP-API-灰度.md)、[相对深度](HTTP-API-深度.md) |
| TF 录制与数据管理 | [录制、列表、详情、下载、删除及卡状态](HTTP-API-TF录制.md)、[录制预检](HTTP-API-TF预检.md) |
| 浏览器录制 | [灰度流、标定快照与归档](HTTP-API-浏览器录制.md) |
| 参数与安装 | [相机/IMU 标定参数](HTTP-API-标定参数.md)、[安装补偿](HTTP-API-安装补偿.md) |
| 系统 | [启动标识、重启与持久幂等](HTTP-API-系统.md) |
| 设备控制 | [按键设置](HTTP-API-按键.md)、[开机策略](HTTP-API-开机策略.md) |
| 飞控 | [MAVLink 状态、配置与操作](HTTP-API-MAVLink.md) |
| 更新 | [应用包上传、安装与状态](HTTP-API-应用更新.md) |

## 文档说明与实际返回字段

OpenAPI 中的 description 是给读者及文档工具看的说明，不属于接口返回的数据，不会自动出现在 HTTP 响应中。响应对象的字段由相应 schema 的 properties 等结构定义，不能把 schema 说明当成响应示例。

当前公开接口不返回名为 description 的解释性字段；错误对象只包含 code，例如 {"error":{"code":"VIO_BUSY"}}。错误解释放在本文档和网页本地文案中。

预览流里的 descriptor 与 description 不同：descriptor 携带实际编码、尺寸、解码参数及帧依赖关系，是解析数据所需的机器可读内容，应按协议保留。

## 维护要求

每次接口变化须在同一变更中更新总览、OpenAPI 和受影响模块文档，必要时同步错误码、[功能与版本对照](../功能与版本对照.md)、模块 README 与客户端示例。详细规则见根目录 [AGENTS.md](../../AGENTS.md)。当前实现、待实现计划和历史实测分别说明；文档整理不代表重新完成板卡验收。

USB 网络 GET/POST /api/network/config：见[网络配置](HTTP-API-网络配置.md)。
# 浏览器三语言读取示例

候选设备网页入口为 /examples.html；实现与限制见 [浏览器示例](../../visualization/examples/README.md)。Python、C++、Rust 共用现有只读 GET /api/vio 与 GET /api/stream?channels=odometry，没有新增 API 字段或控制能力。设备同源页面读取 HTTP，不依赖产品站跨域或电脑连接工具。当前已用 192.168.11.1 正式版真实接口测试候选页面，尚未安装到该设备。

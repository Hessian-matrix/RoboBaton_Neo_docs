# 公开版 API 文档

全分辨率彩色 HTTP 推流：全分辨率彩色在 VIO 关闭时最高 60 fps，开启时最高 30 fps。VIO 开启并叠加深度、原灰、JPEG 灰度或含图像的 TF 录制时，全彩最高 5 fps；原灰 30 与全彩始终互斥。独立预览不限制可选档位。全彩不超过 5 fps 时可与预览并行；超过 5 fps 时，首张完整全彩帧发出后结束已有独立预览连接，全彩占用期间新预览返回 409 IMAGE_CONFLICT。仅查询、改档或开流失败不会切断已有预览。MJPEG 质量在两种工况下均为 1～90，默认 80。实际准入以设备返回的 available_fps 为准。

灰度和彩色配置均返回 supported_fps 和 available_fps。TF 彩色录制会锁定彩色档位，见[彩色配置](HTTP-API-彩色.md)；VIO＋彩色预览下可选原灰 5/30 档，详尽共载规则详见[原灰档位与图像互斥规则](HTTP-API-灰度.md)。


本目录只收录当前公开版 HTTP API 的接口规范、字段说明、错误码与 OpenAPI 契约。以设备实际版本及返回状态为准。

当前接口统一使用 /api 前缀，网页与接口共用 HTTP/1.1 的 80 端口。带版本号的旧地址不提供兼容别名。

## 入口

- [HTTP API 总览](HTTP-API.md)：全部方法与路径、预览、IMU、里程计及 RBH1 封装。
- [OpenAPI 3.1](http-api.openapi.json)：请求、响应、字段类型、枚举及错误响应。
- [错误码](HTTP-API-错误码.md)：错误含义和处理方式。
- Python 主控示例（详见产品说明）：配置、命令、实时流和录制读取。

## 按功能查阅

| 功能 | 接口说明 |
| --- | --- |
| VIO | [启停、状态与设备切换](HTTP-API-VIO状态与设备切换.md)；里程计见总览 |
| 图像 | [彩色配置及编码流](HTTP-API-彩色.md)、[原始灰度与 JPEG Q90](HTTP-API-灰度.md)、[相对深度](HTTP-API-深度.md) |
| TF 录制与数据管理 | [录制、列表、详情、下载、删除、卡状态与安全弹出/重新检查](HTTP-API-TF录制.md)、[录制预检](HTTP-API-TF预检.md) |
| 浏览器录制 | [灰度流、尽力接收和自动分卷归档](HTTP-API-浏览器录制.md) |
| 参数与安装 | [相机/IMU 标定参数](HTTP-API-标定参数.md)、[安装补偿](HTTP-API-安装补偿.md) |
| 系统 | [启动标识、重启与持久幂等](HTTP-API-系统.md) |
| 设备控制 | [按键设置](HTTP-API-按键.md)、[开机策略](HTTP-API-开机策略.md) |
| 飞控 | [MAVLink 状态、配置与操作](HTTP-API-MAVLink.md) |
| VIO 串口控制 | [任务命令、遥控通道与状态](HTTP-API-MAVLink-VIO控制.md) |
| 更新 | [应用包上传、安装与状态](HTTP-API-应用更新.md) |

## 文档说明与实际返回字段

OpenAPI 中的 description 是给读者及文档工具看的说明，不属于接口返回的数据，不会自动出现在 HTTP 响应中。响应对象的字段由相应 schema 的 properties 等结构定义，不能把 schema 说明当成响应示例。

当前公开接口不返回名为 description 的解释性字段；错误对象只包含 code，例如 {"error":{"code":"VIO_BUSY"}}。错误解释放在本文档和网页本地文案中。

预览流里的 descriptor 与 description 不同：descriptor 携带实际编码、尺寸、解码参数及帧依赖关系，是解析数据所需的机器可读内容，应按协议保留。


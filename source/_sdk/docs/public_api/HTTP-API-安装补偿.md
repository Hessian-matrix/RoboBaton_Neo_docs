# 安装补偿接口：读取、保存与生效时机

更新：2026-11-06。适用分支 czr_public；运行及启停期间保存已通过本机回归，026d6ea已部署并完成板卡运行中保存及网页短测；真实串口补偿效果不在本次实测范围。

**VIO 运行或启停期间可以真实保存安装配置。当前实例继续使用启动时的内存副本，下次启动或重启加载新配置。** GET 和 POST 成功响应表示已保存配置，不表示当前实例已采用；第 8 节说明并发生效顺序与网页反馈。

统一入口：[HTTP API](HTTP-API.md)。机器可读定义：[OpenAPI](http-api.openapi.json)，对应 MountConfigWrite、MountConfig、Error。

## 1. 接口用途与边界

安装补偿描述相机光心相对机器人/平台参考点的位置和方向。平台参考点由使用者选择，通常为飞机或车辆中心。

| 方法与路径 | 含义 | 成功返回 |
| --- | --- | --- |
| GET /api/mount/config | 读取板卡保存的安装配置；尚未保存时返回默认值 | HTTP 200，完整配置及 configured |
| POST /api/mount/config | 完整替换并持久化安装配置，再回读 | HTTP 200，实际保存后的完整配置，configured=true |

设备默认地址 http://192.168.11.1，网页和 API 共用 HTTP/1.1 的 80 端口。当前路径不含 v3；不提供 /api/v3/mount/config 别名。

| 使用者 | 安装配置的作用 |
| --- | --- |
| 串口/MAVLink 位姿和速度 | 结合相机—IMU 标定外参，转换到平台参考点；包含安装旋转与杆臂速度补偿 |
| HTTP odometry | 保持已有 IMU 原点及坐标定义，不套用安装补偿 |
| 原始 IMU、灰度、彩色、预览 | 不改变数据内容或采集坐标 |
| 网页安装演示 | 展示当前编辑/读取的安装关系；不证明运行中的 VIO 或飞控已经采用 |

此接口不负责启用串口、启动 VIO 或设置飞控。configured 仅表示配置是否来自已保存文件，不是补偿开关，也不是“当前运行中已生效”的标记。

## 2. GET：读取已保存配置

~~~http
GET /api/mount/config HTTP/1.1
Host: 192.168.11.1
~~~

无查询参数、无请求正文。当前网关不接受 GET 的 Content-Length，包括 Content-Length: 0；客户端直接发送普通 GET 即可。

成功 HTTP 200，Content-Type: application/json，Cache-Control: no-store。JSON 根对象就是配置，没有额外 data 或 ok 包装。未保存时示例：

~~~json
{
  "configured": false,
  "robot_type": "car",
  "convention": "FLU",
  "camera_in_robot": {
    "position": {"x": 0, "y": 0, "z": 0},
    "orientation": {"x": 0, "y": 0.7071067811865476, "z": 0, "w": 0.7071067811865476}
  }
}
~~~

GET 每次读取存储配置。没有新文件时按第 6 节处理旧文件或默认值；已有文件损坏时返回错误，不悄悄替换为默认值。GET 不创建配置文件、不启动 VIO，也不查询正在运行的 VIO 内存副本。

## 3. 字段逐项定义

除 configured 只出现在响应中，其他所有字段在 POST 中都必须完整提供。对象不接受未知、缺少或重复字段。

| 字段 | JSON 类型 | 规则与含义 |
| --- | --- | --- |
| configured | boolean，只读 | true：读取到已保存配置，含兼容旧文件；false：新旧文件都不存在，使用默认安装 |
| robot_type | string | car、drone、custom。平台分类；API 不会根据它推断坐标约定或自动旋转配置 |
| convention | string | FLU：X 前、Y 左、Z 上；FRD：X 前、Y 右、Z 下。均为右手平台本体系，不是世界 ENU/NED 声明 |
| camera_in_robot | object | 相机坐标到平台坐标的刚体变换 T_robot_camera |
| camera_in_robot.position | object | 相机光心在平台坐标系的位置，单位 m；从平台原点指向光心的向量，用平台轴表达 |
| position.x / y / z | number | 有限实数，每轴范围 [-10, 10]，单位 m；不接受数字字符串、null、NaN、Infinity |
| camera_in_robot.orientation | object | 将相机系向量旋转到 convention 指定的平台系的单位四元数 |
| orientation.x / y / z / w | number | 有限实数；具名 xyzw，w 是标量部分。JSON 键顺序不重要 |

四元数必须满足 abs(x²+y²+z²+w²−1) ≤ 1e-5；服务端接受后归一化，因此响应中的末位小数可能变化。q 与 −q 表示同一个旋转。

相机坐标固定：X 图像向右、Y 图像向下、Z 沿镜头向前，原点为光心。其与平台坐标之间的关系为：

~~~text
point_robot = R_robot_camera × point_camera + position_robot_from_camera
~~~

例如 FLU 中 position.x=0.12 表示光心在平台原点前方 12 cm，不是 IMU 前移 12 cm。相机—IMU 外参由独立标定接口管理，不能把 IMU 安装偏移直接填入光心位置。

默认 car/FLU、零平移、q=(x=0,y=√0.5,z=0,w=√0.5)。该旋转将相机 +X 映射到平台 −Z、+Y 到 +Y、+Z 到 +X。网页“正装、零欧拉角”是在这个安装基准上表达，不是单位四元数。

网页切换 FLU/FRD 时会转换向量和旋转以保持物理安装不变。API 不代做这种转换：POST 的数值已经必须用指定 convention 表达。

## 4. POST：完整保存

请求头：

~~~http
POST /api/mount/config HTTP/1.1
Host: 192.168.11.1
Content-Type: application/json
Content-Length: <实际 UTF-8 正文字节数>
~~~

示例：在默认 FLU 安装方向基础上，将光心设在平台前方 12 cm。

~~~json
{
  "robot_type": "car",
  "convention": "FLU",
  "camera_in_robot": {
    "position": {"x": 0.12, "y": 0, "z": 0},
    "orientation": {"x": 0, "y": 0.7071067811865476, "z": 0, "w": 0.7071067811865476}
  }
}
~~~

请求要求：

- 完整替换，不是 PATCH；不能仅提交 position.x，也不能把 GET 响应带着 configured 原样发回。
- 正文 1～1023 字节，无内嵌 NUL；唯一 Content-Length，由 HTTP 库按实际字节计算。
- 当前网关精确接受 Content-Type: application/json；不接受附加 charset 参数。
- 不支持 Transfer-Encoding、Upgrade、Expect；接收完整正文的期限为 3 秒。
- 不要求 Idempotency-Key，也没有 revision、ETag 或 CAS；不实现请求去重历史。同一配置可重复提交，但遇到结果不确定应先 GET 确认。
- **VIO 运行及启停命令执行期间均允许保存。** 预览、彩色、原始采集和 TF 录制自身不单独阻止本接口；应用更新期间仍禁止写配置。

成功响应 HTTP 200，例如：

~~~json
{
  "configured": true,
  "robot_type": "car",
  "convention": "FLU",
  "camera_in_robot": {
    "position": {"x": 0.12, "y": 0, "z": 0},
    "orientation": {"x": 0, "y": 0.7071067811865476, "z": 0, "w": 0.7071067811865476}
  }
}
~~~

这里的 200 是同步完成文件写入、同步和回读后的成功，不是 VIO 动作接口的 202“已受理”。收到 200 后，文件中已保存新值；配置下一次 VIO 启动加载。接口本身不会停止、重启或启动 VIO。

## 5. 错误和结果不确定时的处理

错误只有 code，不带 message。含义由文档及客户端本地文案解释。例如应用更新期间拒绝保存：

~~~json
{"error":{"code":"UPDATE_BUSY"}}
~~~

| HTTP 状态 | code | 发生条件与处理 |
| --- | --- | --- |
| 400 | INVALID_REQUEST | 通用HTTP请求格式错误；也用于GET携带禁止的长度/传输头。纠正请求后重试 |
| 400 | INCOMPLETE_BODY | 请求头未在网关期限内完整接收；此处尚未进入配置业务，不等于POST正文接收超时 |
| 400 | INVALID_CONFIG | POST头部、正文长度、JSON、字段、数值、坐标约定或单位四元数不合法；未写配置 |
| 404 | NOT_FOUND | 路径、方法、查询参数不受支持；包括旧版带版本号路径。不返回405 |
| 408 | REQUEST_TIMEOUT | 未在3秒内完整接收POST正文；业务写入尚未开始 |
| 409 | UPDATE_BUSY | 应用更新占用设备写操作；结束更新后再保存 |
| 500 | CONFIG_SAVE_FAILED | 创建文件、写入、持久保存确认、替换配置或保存后回读失败；结果可能不确定，先GET核对 |
| 500 | CONFIG_LOAD_FAILED | 配置损坏、无法读取或结果不可序列化；不默认清除用户文件 |
| 500 | CALIBRATION_LOAD_FAILED | 换算相机—IMU安装关系时标定文件损坏或不可读；文件不存在时使用统一默认外参 |
| 503 | DEVICE_UNAVAILABLE | 网关无法连接设备服务；稍后读取确认状态 |
| 503 | DEVICE_REQUEST_UNCONFIRMED | 网关与设备服务之间的回复未确认；可能已经写入，先GET核对 |
| 503 | DEVICE_PROTOCOL_MISMATCH | 网关与设备服务的协议不匹配或回复不合法；核对配套版本 |

错误列表针对当前代码；不要把HTTP 500、503或网络断开直接解释为“文件一定没改”。例如替换配置完成后目录持久保存确认失败，会返回保存失败，但新文件已经可见。

客户端建议：POST后检查HTTP状态和回读值；响应丢失时GET比较位置、坐标约定、机器人类型和等价旋转，再决定是否重试。浮点允许合理误差，四元数接受q/−q等价。配置没有多客户端冲突检测，后完成的保存会覆盖前一个；GET也可能读到其他客户端刚保存的值。

## 7. 调用示例

只读查询（Windows PowerShell可将curl写成curl.exe）：

~~~sh
curl --fail-with-body http://192.168.11.1/api/mount/config
~~~

将第4节请求JSON保存为mount.json，然后保存：

~~~sh
curl --fail-with-body -X POST http://192.168.11.1/api/mount/config -H "Content-Type: application/json" --data-binary @mount.json
~~~

Python示例在 tools/http-api 目录运行，使用现有client.py：

~~~python
from client import Device

board = Device("http://192.168.11.1")
config = board.mount_config()
print(config)
# VIO运行时也可以保存；当前实例不热加载，下次启动生效。
config.pop("configured")
config["camera_in_robot"]["position"]["x"] = 0.12
saved = board.mount_config(config)
assert saved["configured"] is True
confirmed = board.mount_config()
assert abs(confirmed["camera_in_robot"]["position"]["x"] - 0.12) < 1e-9
~~~

读取默认配置并改变位置，可保留设备当前坐标约定和安装方向，避免误把单位四元数当作本产品的默认正装。

## 8. 生效顺序与网页反馈

- 当前实例继续使用启动时内存副本；保存不停止、不重启算法，不热替换补偿。
- 主配置文件立即原子写入并同步；POST成功200仍返回回读配置，GET读取最新保存值。无pending文件、额外接口或新增响应字段。
- 保存完成后才发起的下一次VIO启动应加载新配置；并发保存与启动按实际读取/原子替换先后确定。已经完成配置读取的实例保持旧值，即使其初始化尚未结束。
- 多个客户端保存由设备服务串行执行，每个POST回读自身保存值；后完成的保存最终覆盖前者，后续GET可能读到其他客户端的新值。没有CAS或修订号保护。
- 网页允许运行时保存，成功且回读值一致后显示“已保存到板卡，下次 VIO 启动或重启后生效。”；另行注明当前页不是运行实例的配置查询。
- 编辑、导入、重新读取、切换设备或再次请求时清除上次保存成功提示。失败保留草稿并提示核对，不声称已应用；不自动发VIO启停命令。
- 错误继续仅返回error.code；相机/IMU标定仍在运行时拒绝保存，更新维护互斥保持。

本机验证使用真实设备服务与HTTP网关、实际安装配置读取函数和生命周期锁，验证保存/回读、旧快照、新启动读取、并发、写入失败和标定保护。网页验证覆盖中英文、明暗模式及320/390/1440px。测试不执行真实相机或VIO估计，不代表实机运动、串口输出或长期稳定性验收。


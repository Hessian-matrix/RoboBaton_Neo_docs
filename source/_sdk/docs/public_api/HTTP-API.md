# RoboBaton Neo HTTP API

网页与接口共用 HTTP/1.1 的 80 端口，默认设备地址 http://192.168.11.1/。所有接口使用 /api 前缀；不提供带版本号地址的别名或重定向。网关、设备服务、网页与客户端应成套更新。

接口字段以 [OpenAPI](http-api.openapi.json) 为准；错误仅返回 error.code，含义见 [错误码](HTTP-API-错误码.md)。进程状态查询与实时订阅独立，命令返回 202 只表示受理。

公开版接口文档集中在本目录，导航见 [文档目录](README.md)。OpenAPI 的 description 仅为文档说明，不随接口响应发送。当前接口不返回名为 description 的解释性字段；预览流的 descriptor 是编码与解码所需的实际配置，按流协议保留，不能与文档说明混淆。

文档维护约定（2026-11-06）：每次接口变更必须同一变更更新本索引、OpenAPI及受影响模块说明，包括字段、错误、保存/生效时机和流生命周期。以当前源码行为为契约，待实现计划单列，历史实测不替代当前验收。同步要求已写入根目录AGENTS.md。

配置保存接口可能同步返回200，例如安装补偿；不能把所有POST都理解为异步受理。安装补偿GET读取磁盘配置，POST持久化后回读；支持VIO运行及启停期间保存；当前实例保持启动快照，下次启动或重启加载新配置。GET返回已保存配置，不代表当前实例已采用。

## 模块详细文档

以下文档配合OpenAPI提供字段、示例和行为说明；旧验证报告中的版本路径只描述历史构建。

| 模块 | 详细说明 |
| --- | --- |
| 安装补偿 GET/POST /api/mount/config | [逐字段、请求/响应、错误、配置文件与生效时机](HTTP-API-安装补偿.md)，2026-11-06按当前源码重新核对 |
| VIO 启停与状态 | [控制及真实状态](HTTP-API-VIO状态与设备切换.md)，里程计和IMU结构见本文对应章节 |
| 视频预览 | 见本文“预览与断线处理”“传输封装”章节；[旧版预览实测](../公开版预览接口-2026-11-03.md)仅作历史证据 |
| 全分辨率彩色 | [编码配置与彩色流](HTTP-API-彩色.md) |
| 灰度及浏览器录制 | [灰度](HTTP-API-灰度.md)、[JPEG灰度与浏览器录制](HTTP-API-浏览器录制.md) |
| 相对深度 | [固定384配置、帧封装与生命周期](HTTP-API-深度.md) |
| TF录制、数据管理、卡状态 | [录制、列表、详情、下载与删除](HTTP-API-TF录制.md)、[TF预检](HTTP-API-TF预检.md) |
| 相机/IMU标定参数 | [参数读取与保存](HTTP-API-标定参数.md) |
| 实体按键 | [动作和录制预设](HTTP-API-按键.md) |
| 开机策略 | [下次开机自动启动配置](HTTP-API-开机策略.md) |
| 串口与飞控 | [MAVLink状态、管理和参数](HTTP-API-MAVLink.md) |
| 系统状态与重启 | [统一系统重启、业务准入与持久去重](HTTP-API-系统.md) |
| 应用与系统更新 | [应用包更新](HTTP-API-应用更新.md)、[系统A/B接入边界](../A-B系统更新接入.md) |

完整字段类型、枚举及各响应schema集中在[OpenAPI](http-api.openapi.json)。某模块的计划或未验证能力不能仅因出现在文档中就视为可用。

## 接口索引

| 方法与路径 | 操作标识 |
| --- | --- |
| POST /api/vio | acceptVioCommand |
| GET /api/vio | 查询 VIO 实际状态 |
| GET /api/stream | observeStream |
| GET /api/color/config | getColorConfig |
| POST /api/color/config | setColorConfig |
| GET /api/recording | getRecording |
| POST /api/recording | acceptRecording |
| GET /api/monitor | getMonitor |
| GET /api/datasets | listDatasets |
| GET /api/datasets/{id} | getDataset |
| DELETE /api/datasets/{id} | deleteDataset |
| GET /api/datasets/{id}/archive | downloadDataset |
| GET /api/recording/check | getRecordingPreflight |
| POST /api/recording/check | acceptRecordingPreflight |
| GET /api/mount/config | getMountConfig |
| POST /api/mount/config | saveMountConfig |
| GET /api/calibration/parameters | getCalibrationParameters |
| POST /api/calibration/parameters | saveCalibrationParameters |
| GET /api/buttons/config | getButtonsConfig |
| POST /api/buttons/config | saveButtonsConfig |
| GET /api/serial/status | getSerialStatus |
| GET /api/mavlink/status | getMavlinkStatus |
| GET /api/mavlink/parameters | getMavlinkParameters |
| POST /api/mavlink/parameters | setMavlinkParameters |
| POST /api/mavlink | manageMavlink |
| GET /api/system/status | getSystemStatus |
| POST /api/system/reboot | acceptSystemReboot |
| GET /api/update | getUpdate |
| POST /api/update | acceptUpdate |
| POST /api/update/package | uploadUpdatePackage |
| GET /api/boot/config | 查询已保存的开机策略 |
| POST /api/boot/config | 保存下次开机的 VIO 自动启动策略 |
| GET /api/depth/config | getDepthConfig |

共 35 个方法/路径操作。stream 每条连接只选择 preview、odometry、imu、color、gray、gray_jpeg、depth 中一个通道。

系统重启受理期间，业务命令及配置写入返回409 REBOOT_BUSY；普通查询保持可用。安装接口仅接受 install，更新后的重启使用 POST /api/system/reboot {}。两类请求分别持久去重；系统重启完成不等于更新成功。详见[系统接口](HTTP-API-系统.md)。

## VIO 控制与状态

GET /api/vio 查询 stopped、starting、running、stopping、restarting，以及 tracking 和 error。POST /api/vio 使用 {"action":"start"}、stop 或 restart，须携带 Idempotency-Key。一次只执行一个新命令，冲突返回 409；相同 key/action 在设备服务进程内保留 10 分钟、最多 32 项。网关重启不清空这些记录，设备服务重启会清空。不要把超时解释为未执行，先查询实际状态。

启停使用同一个按钮，重启独立。查询真实状态后更新按钮，不凭 202 或里程计心跳推断算法已运行。详见 [状态与切换](HTTP-API-VIO状态与设备切换.md)。

## 1.1 IMU 通道（2026-11-03）

GET /api/stream?channels=imu；不需要另一个启动命令。连接持有自身 IMU 引用，断开只释放自己；不启动或停止 VIO，不启动相机。每连接仅一个通道，最多 4 个 IMU 连接，整个 Web 服务最多 16 个连接。无空位返回 429 STREAM_LIMIT；源或低优先级发送线程不可用返回 503 IMU_UNAVAILABLE。

先发送 channel 0/format 1 的 metadata，再发送 **channel 3/format 1 的单样本 JSON**，RBH1 40 字节头保持不变。一个样本一个 RBH1 消息，不等待凑批；HTTP/TCP 可以合并或拆分字节，因此不能把一次 read 当作一个样本。RBH1 sequence 从 1 开始，是本连接的消息序号，与下面真实采样 seq 不同。

~~~json
{"header":{"seq":"0","stamp":{"sec":146,"nanosec":543970875}},"linear_acceleration":{"x":0.01,"y":-0.02,"z":9.8},"angular_velocity":{"x":0.001,"y":-0.002,"z":0.003}}
~~~

| 字段 | 规则 |
|---|---|
| header.seq | 驱动平均后的真实输出序号，uint64 十进制字符串，允许 0；不以传输计数替代。缺号表示平均输出样本未送到当前观察者；原始 FIFO 丢样可能只体现为时间间隔变大，不能单靠此序号证明原始采样完整 |
| header.stamp | 必须有效；CLOCK_MONOTONIC_RAW 平均窗口内采样时间的算术平均。sec 为整秒，nanosec 为秒内余数；组合值不超过 INT64_MAX。不是 UTC、发送或到达时间 |
| linear_acceleration | x/y/z 有限数，m/s²，包含重力响应，未做 VIO 偏置扣除 |
| angular_velocity | x/y/z 有限数，rad/s，未做 VIO 偏置扣除 |

固定原点与坐标轴是 IMU 传感器自身，与公开里程计 child 相同；不随安装/串口配置改变。沿用驱动 1600 Hz / 8 样本平均约 200 Hz（ICM42688 则为 2000 / 10），不修改硬件采样或平均算法。没有 samples 批量数组、姿态、协方差、confidence 或温度。网页在适配层转换成单元素数组供既有曲线使用，这不是线上批量格式。

**资源顺序为 VIO ＞ TF 录制 ＞ 对外传输。** 采集先写 VIO 环形缓冲及录制观察历史，随后 trylock 写外部独立 32 样本有界副本并非阻塞唤醒。网络线程从该副本读取，在锁外编码/发送；它不消费 VIO 队列，也不持有录制历史锁。外发锁忙时只放弃外发副本。默认采集/VIO nice 0（VIO 既有 RT 配置照常），录制 nice 5，外部驱动线程和 HTTP IMU 线程 nice 10。此机制减少竞争，不能保证任意满载情况下零开销或绝不丢样。

TF 写盘不在采集线程或 VIO 锁内；保留原 46006 板内录制链路及归档格式。慢存储导致历史/网络队列耗尽、序号缺口、断线或写入错误时，录制标记失败/不完整；不会悄悄存成完整数据集。不保证卡硬件永久卡死时写调用能被限时取消。TF 录制接口见专项说明。

板内录制专用 socket 在 connect 前设置有界接收缓冲：每路图像请求 2 MiB，IMU/遥测各 256 KiB；Linux 返回的记账上限分别为 4 MiB/512 KiB，含内核开销，不等于可缓存同等大小的净图像。检查实际生效值，系统限制较小时由 root 服务对该 socket 使用 SO_RCVBUFFORCE；无权限/不足则明确启动失败，不修改全局 sysctl。只用于容纳短时消费停顿，持续阻塞仍会断开并报错；公开 IMU 网络流不增大缓冲、不积攒历史。

发送路径不主动等批。由于硬件 FIFO、水位、中断和 Linux 调度，一次唤醒仍可能得到多个已产生样本，它们分别封装发送，不能把平均 5 ms 周期等同于端到端延时。内部/外部 socket 设置 TCP_NODELAY；内核 socket 缓冲及应用队列均有界。外发观察副本/bridge 不补发超过 100 ms 的历史样本；已进入 TCP 的字节无法撤回。板内消费者尚有未发完的前一条样本时关闭该慢连接，HTTP 发送超过 1 秒或 TCP 持续不可达时结束连接；健康客户端独立继续。

IMU 源停止、源 epoch 改变、序号倒退/重复、无新鲜样本 3 秒或非法数据时结束旧 HTTP 响应。客户端重新 GET 获取新数据；源未重启时序号继续，网络重连不会重启算法。没有跨连接重放/补传，也不伪造新轨迹。IMU 持续数据本身维持客户端活性，没有无数据时无限等待的心跳；与里程计可空闲等待算法的行为不同。

网页仅在实时页运行监测面板可见时共享一条 IMU 订阅；隐藏侧栏、切页、关闭页后释放。断线清空旧曲线并约 1 秒后重连，不能用旧值伪装实时数据。Python 示例：python tools/http-api/client.py http://192.168.11.1 --channel imu --messages 10。

以上为实现契约；实机频率、共载和 TF 验证结果单独记录，编译通过不代表卡或算法精度验收。

## 3. 里程计业务数据

GET /api/stream?channels=odometry。**订阅不启动算法，断开不停止算法**。无算法进程时仍维持 HTTP，每 2 秒发送传输心跳；心跳不表示算法活跃。板内源退出时清除未完整的一行，重连板内源，不交付跨源拼接数据。

~~~json
{
  "header": {"seq": "9007199254740993", "stamp": {"sec": 148, "nanosec": 230000000}},
  "pose": {
    "position": {"x": 1.25, "y": -0.3, "z": 0.08},
    "orientation": {"x": 0, "y": 0, "z": 0, "w": 1}
  },
  "twist": {
    "linear": {"x": 0.2, "y": 0.01, "z": 0},
    "angular": {"x": 0, "y": 0, "z": 0.1}
  },
  "confidence": null,
  "trip_distance_m": 12.345
}
~~~

| 字段 | 类型/范围 | 定义 |
|---|---|---|
| header.seq | uint64 十进制字符串，1～18446744073709551615 | VIO 真实输出序号，非图像帧号/HTTP 传输号。同一算法实例持续递增，重连不归零；算法进程重启重新计数 |
| header.stamp | 对象或 null | 算法状态时间，已包含相机→IMU 标定时间偏移；不是接收时间 |
| stamp.sec | JSON 整数，0～9223372036 | 同一 CLOCK_MONOTONIC_RAW 时间的整秒部分 |
| stamp.nanosec | JSON 整数，0～999999999 | 秒内纳秒余数；组合值须 ≤ INT64_MAX |
| pose | 对象或 null | 位姿；初始化/失效为 null，不伪造零位姿 |
| pose.position | x/y/z 有限数，m | 固定 IMU 原点在局部世界系的位置 |
| pose.orientation | 具名 x/y/z/w 有限数 | 单位四元数 world_from_imu，即 parent_from_child；旧生产者 wxyz 真实重排 |
| twist | 对象或 null | 速度；当前生产者与 pose 同时有效/无效 |
| twist.linear | x/y/z 有限数，m/s | IMU 原点的线速度，在 IMU 系表达；实际执行 Rᵀ·v_world |
| twist.angular | x/y/z 有限数，rad/s | IMU 系角速度，使用估计时刻插值并扣除 gyro bias 的陀螺仪值 |
| confidence | 有限数 [0,1] 或 null | 整个 odometry 仅一个；算法尚未可靠提供，本次始终 null。0 与 null 不同 |
| trip_distance_m | 非负有限数或 null，米 | 本次 VIO 进程内 IMU 原点的三维行进距离；初始 0，不可用为 null |

没有 covariance、frame_id/child_frame_id、相机参数、session/reset/轨迹段 ID。stamp 无可靠同步时整个对象为 null，pose/twist 可独立于 stamp 可用性表达；不能用 Date.now() 补值。

**固定坐标约定：** parent 是右手、Z 朝上的 VIO 局部世界，yaw 为初始化时的局部参考，不承诺地理 ENU/NED。child 固定为 IMU 原点与传感器轴，XYZ 与驱动 IMU 数据一致，**不是**按安装配置自动变成机器人 FLU。 mono_runner 明确为网络输出选择原始 IMU 状态；安装/杆臂变换仍用于原有串口输出，不重复补偿。设备壳体与 IMU 的物理安装关系本轮未测量，不虚构该映射。

时间属于设备本次启动的 monotonic_raw，不是 Unix/UTC，也不能直接跨设备比较。sec/nanosec 只是表示形式。Python 用 int，JavaScript 对 seq 和组合 ns 用 BigInt。例：9223372036854775807 ns → sec=9223372036，nanosec=854775807。

**轨迹连续性：** 断网/重连保留已有轨迹，继续接收后续样本，不补造丢帧。网页仅观察到输出序号回退时自动清空旧轨迹，用户也可手动清空；202 不清轨迹。没有实例标识意味着：若算法在离线期间重启且序号超过旧值，或恰好取到同一序号，接收端无法可靠辨认。按本次约定保留这个边界，不暗中新增轨迹标识；自动重置/重启检测以后讨论。

## 4. 预览与断线处理

GET /api/stream?channels=preview。保留上轮编码与恢复：544×640、H.264 Annex B、15 fps、1500 kbit/s。每个 GET 取得自己的消费引用；退出只释放自己；最后一个使用者退出后驱动等待 3 秒再停预览编码。VIO 启停不调用关闭预览的逻辑。

每类最多 4 个流连接，HTTP 服务总共最多 16 个活动请求。分类上限返回 429 STREAM_LIMIT；相机源未就绪返回 503 PREVIEW_UNAVAILABLE。非阻塞发送，单次发送最长 1 秒；持续不读会断开自身连接，不无限排队、不拖住算法。不会丢半个 H.264 包后直接继续播放。原始相机帧上限 2 MiB，RBH 分片 64 KiB；源消息读取超时 8 秒，首次参数集/IDR 等待最多约 10 秒。流中错误可能直接结束 HTTP，接收端丢弃不完整消息。

网页预览/里程计独立重连；预览重新获取描述及参数集并从实际 IDR 开始。HTTP 心跳中断 10 秒会重连；视频无新帧 8 秒触发播放器重连。里程计无需关键帧，消费新样本即可。保留编码器正常 P 配置，不把源码配置写成“实机已经证明无重排序”。历史预览实测不代替本次  的实机复核。

## 5. 线上封装

Content-Type 为 application/vnd.robobaton.stream，Transfer-Encoding 为 chunked。HTTP chunk、TCP read 都不等于业务消息。先由 HTTP 库去掉 chunked，再解析 **RBH1**。RBH1 本身仍是版本 1，40 字节小端头：

| 偏移 | 长度 | 含义 |
|---:|---:|---|
| 0 | 4 | ASCII RBH1 |
| 4 | 2 | 封装版本 1 |
| 6 | 2 | 头长 40 |
| 8 | 2 | channel：0 控制、1 preview、2 odometry、3 imu、4 color、5 gray、6 gray_jpeg、7 depth |
| 10 | 2 | format：1 JSON、6 RBF2、7 编码图像、8 原始灰度、9 原始深度 |
| 12 | 4 | flags：bit0 FIRST、bit1 LAST，其他为 0 |
| 16 | 8 | 连接内该 channel 传输序号，从 1 递增，与业务 header.seq 不同 |
| 24 | 4 | 完整消息字节数 |
| 28 | 4 | 分片偏移 |
| 32 | 4 | 分片字节数，1～65536 |
| 36 | 4 | 保留，必须为 0 |

分片连续无溢出；FIRST 等价于 offset=0，LAST 等价于 offset+size=total。重连丢弃重组缓存，传输序号重启；业务 seq 不受影响。共享解析器上限 2 MiB+8208 字节/消息、16 MiB 重组内存，JSON 上限 128 KiB。本版里程计正文最多 2047 字节，一片交付。

通道 0 首条 JSON：

~~~json
{"type":"metadata","connection_id":"odometry","stream":{"source":{"type":"live"},"channels":[{"id":2,"name":"odometry","format":1}]}}
~~~

connection_id 不是轨迹标识、算法实例或可靠设备身份；odometry/imu 固定为同名字符串，preview 沿用随机连接 ID。里程计交付元数据、心跳、通道2业务 JSON；IMU交付元数据与通道3单样本 JSON，没有 RBF2 包裹或描述依赖。

预览仍为 format=6，使用 **RBF2/schema 2 image**：16 字节 RBF2 头＋JSON 元数据＋H.264 AU；device_context、descriptor 先于引用它们的帧。payload 单位/坐标/编码语义未改，保持 decoder config、真实 IDR 判定和有界描述依赖。旧v2数据模型文档已随分支清理移除；当前逐字段校验见[配套图像解析器](../../tools/http-api/camera_model.py)，不能据旧文档推断存在v2描述查询接口。未知描述不猜最新配置，geometry=null 不表示可进行几何投影。

## 模块说明与客户端

- [彩色输出](HTTP-API-彩色.md)、[灰度采集](HTTP-API-灰度.md)、[384 相对深度](HTTP-API-深度.md)。
- [TF 录制](HTTP-API-TF录制.md)、[录制预检](HTTP-API-TF预检.md)、[浏览器录制](HTTP-API-浏览器录制.md)。
- [标定参数](HTTP-API-标定参数.md)、[安装补偿](HTTP-API-安装补偿.md)、[按键](HTTP-API-按键.md)。
- [飞控接入](HTTP-API-MAVLink.md)、[开机设置](HTTP-API-开机策略.md)、[应用更新](HTTP-API-应用更新.md)。

Python 标准库客户端：

~~~sh
python tools/http-api/client.py http://192.168.11.1 --vio-status
python tools/http-api/client.py http://192.168.11.1 --channel odometry --messages 100
python tools/http-api/client.py http://192.168.11.1 --depth-config
~~~

Content-Type 为 application/vnd.robobaton.stream。metadata 和录制清单不带 api_version；RBH1、RBF2、RBR1 自身的格式版本仍用于解析与校验。格式版本不等于 HTTP 路径版本。

历史实测报告记录各自日期的软件，不能作为本次接口地址调整的板卡验收。本次检查范围见 [源码与接口复核](../源码与接口复核-2026-11-06.md)。

## 有效标定参数与启动警告

GET /api/calibration/parameters 返回有效参数及 source=default|saved；仅 mono.conf 不存在时返回代码默认参数，损坏文件返回500。POST 不接受只读source字段。缺少文件可启动VIO，GET /api/vio 新增独立 warning 字段；默认参数运行时为 {"code":"CALIBRATION_REQUIRED"}，详细时序见[VIO状态](HTTP-API-VIO状态与设备切换.md)。默认参数不证明精度达标，不自动落盘；参数定义见[标定参数](HTTP-API-标定参数.md)。

USB 网络 GET/POST /api/network/config：见[网络配置](HTTP-API-网络配置.md)。

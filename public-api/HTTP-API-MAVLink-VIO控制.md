# MAVLink 控制 VIO

2026-11-25。公开产品 /api；1.0.86 已在 Neo 板卡验证电脑串口直连控制。真实飞控转发和遥控器尚未验收。

## 控制规则

COMMAND_LONG、可选 RC_CHANNELS、HTTP 和实体按键复用 VIO 异步执行入口。先通过准入的动作执行；执行期间拒绝其他动作，不排队、不自动补执行，没有永久控制权或来源优先级。命令异步执行。串口不能绕过更新、系统重启、TF 预检、里程计录制和图像资源限制。

启动完成只表示进程启动，不代表初始化、有效定位或飞控融合完成。停止只作用于 VIO；心跳、预览、IMU 和不依赖里程计的录制继续。录制包含里程计时拒绝停止/重启。已运行时 start、已停止时 stop 为无副作用成功；系统更新/重启仍先拒绝。restart 只重启算法。

不识别接收机失联，不增加手动/自动模式，不依据 armed 限制任务中的 VIO 启停。飞控管理活跃时暂不受理新的串口 VIO 命令，遥控基准清空；这不会自动停止算法。

## 遥控配置 HTTP

| 接口 | 用途 |
|---|---|
| GET /api/mavlink/vio/config | 读取 Neo 保存的遥控通道 |
| POST /api/mavlink/vio/config | 保存并立即采用通道设置 |

无查询参数。GET 不带请求体；POST 为 Content-Type: application/json、最多64字节、必须带标准 UUID Idempotency-Key。请求与成功返回只有 rc_channel：JSON整数1～18，或 null（默认关闭）。字符串、布尔值、小数、重复字段、未知字段均拒绝。

~~~http
POST /api/mavlink/vio/config
Content-Type: application/json
Idempotency-Key: 123e4567-e89b-42d3-a456-426614174000

{"rc_channel":7}
~~~

POST成功 HTTP 200、正文 {"rc_channel":7}；GET 返回相同结构。关闭发送 {"rc_channel":null}，成功也返回此结构。失败示例：HTTP 400、正文 {"error":{"code":"invalid_request"}}。不增加 message。

遥控通道配置独立持久保存。修改通道清除基准但不触发 VIO；同值保存不清基准。不存在时默认禁用，损坏时禁用并返回 config_load_failed。保存失败返回 config_save_failed，先查询实际状态，不自动重写。

保存与其他设备变更串行准入。串口 VIO、飞控管理或参数读取活跃时409 operation_busy。同UUID＋同配置重用原成功响应，不再次写盘；同UUID不同配置409 idempotency_key_conflict。配置去重独立32项，每项10分钟，不提前淘汰；满时503 history_capacity。服务/Neo重启清空。重复响应是原结果，不保证仍为当前值，网页保存后GET核对；丢响应只读查询，不自动重复POST。

| HTTP | error.code | 含义 |
|---|---|---|
| 400 | invalid_request / invalid_query | 请求体、UUID或查询不合法 |
| 409 | operation_busy | 管理、参数读取或串口VIO占用 |
| 409 | idempotency_key_conflict | UUID用于不同配置 |
| 409 | UPDATE_BUSY / REBOOT_BUSY | 更新/重启保护 |
| 500 | config_save_failed | 持久化未确认，遥控关闭 |
| 503 | config_load_failed / service_unavailable / history_capacity | 配置损坏、服务不可用、去重容量不足 |

通用网关/IPC错误仍见[错误码](HTTP-API-错误码.md)。

## COMMAND_LONG 与 ACK

使用 common 的 MAV_CMD_USER_1=31010。下列参数是 **Neo私有契约**，不是通用飞控启动算法指令。只接收精确指向Neo当前system_id/component_id的报文，默认组件197；广播不启停。发送者sys/comp须非零，自身身份回环忽略。仅接收 incompat_flags=0 的 MAVLink 2 帧，适用于受信串口；真实飞控路由能力待验证。

| 字段 | 值 |
|---|---|
| command | 31010 |
| target_system / target_component | Neo当前身份，通常system同已绑定飞控 |
| param1 | 0=stop、1=start、2=restart，有限整数 |
| param2 | 1～65535请求编号，有限整数 |
| param3～7 | 必须0 |
| confirmation | 首次0，重发可递增，不作为去重键 |

支持MAVLink2合法尾零裁剪；目标字节必须存在。错误目标忽略，其他精确指向Neo的command回UNSUPPORTED。CRC错误或不支持的incompat_flags忽略。

ACK.command=31010；ACK.target_system/component指向**原发送者**。标准ACK不自动回显请求编号，本契约定义 result_param2=(request_id << 8) | reason，为int32内非负整数、最大16777215。客户端解码：request_id=值>>8，reason=值&255。无合法编号时高位0。发送端必须支持此约定。

| result | 值 | 含义 |
|---|---|---|
| ACCEPTED | 0 | 动作完成或原状态已满足 |
| TEMPORARILY_REJECTED | 1 | 忙、链路/服务不可用、去重容量满，未排队 |
| DENIED | 2 | 参数、编号冲突或业务条件不满足 |
| UNSUPPORTED | 3 | 未支持的command |
| FAILED | 4 | 受理后动作失败 |
| IN_PROGRESS | 5 | 已受理，异步执行中 |

IN_PROGRESS.progress=255（未知），成功100，其余255。受理回IN_PROGRESS，完成回终态；无副作用动作可直接ACCEPTED。发送ACK失败不撤销动作。

按sender sys＋comp＋request_id去重，32项包含进行中及拒绝结果，终态保留10分钟，不提前淘汰；满时拒绝新请求。重复同动作回原结果，不同动作DENIED。10分钟内编号不可重用；过期或服务/Neo重启后不能保证去重，未知结果不要跨重启盲目重发restart。每个发送端对每个目标最多保留一个未完成31010请求，按本契约编号匹配ACK，不能用不理解编号的通用命令库推断结果。

| reason | 原因码 | result |
|---|---|---|
| 0 | 无错误 | 0/5 |
| 1 | invalid_request | 2 |
| 2 | command_busy | 1 |
| 3 | update_busy | 2 |
| 4 | reboot_busy | 2 |
| 5 | check_active | 2 |
| 6 | recording_requires_vio | 2 |
| 7 | image_conflict | 2 |
| 8 | command_unavailable | 1 |
| 9 | command_failed | 4 |
| 10 | request_id_conflict | 2 |
| 11 | history_capacity | 1 |
| 12 | link_unavailable | 1 |

例：sender42/100向Neo1/197发restart，编号17。受理ACK result=5、progress=255、result_param2=4352、target=42/100；完成ACK result=0。相同编号重复发送不再重启。

## RC_CHANNELS

只接收已绑定、心跳在线飞控target/1的选定通道，通道总数须覆盖所选通道。有效800～2200µs；0/65535或越界不可用。time_boot_ms只剔除重复/倒序，支持32位回绕，不作为VIO时间戳或命令编号。

- ≤1300µs低位stop；≥1700µs高位start；中间不操作。
- 连续收到新数据且同区域稳定300ms后确认。首次稳定位置只建基准；之后稳定区域改变触发一次。中位可作为下一次拨动的起点。
- 无效值、串口重开、飞控离线/确认重启、管理过程、通道改变、RC数据间隔达到1秒后清基准。恢复先建基准，不补执行。此为数据新鲜度规则，**不是接收机失联识别**；飞控持续发送失联保护值仍属于有效输入。
- 忙时消费该边沿并显示拒绝，保持原位置不重试。需再次拨动才形成新请求；拨杆不支持restart。
- 启用连接后请求MAV_CMD_SET_MESSAGE_INTERVAL=511，param1=65、param2=100000µs（10Hz），最多3次、间隔5秒；只有收到有效所选通道才标可用，不靠ACK宣称支持。关闭不修改飞控消息频率，不持久修改飞控参数；实际速率由飞控决定。

## 状态与心跳

GET /api/mavlink/status 保留原字段并追加 vio_control。即使查询管理历史，此对象仍为实时快照，与operation无关。

~~~json
{"custom_mode":3,"rc_channel":7,"rc_available":true,"rc_ready":true,"pulse_us":1800,"position":"high","last_action":{"source":"rc_channels","action":"start","result":"succeeded","reason":null,"request_id":null}}
~~~

| 字段 | 类型、含义 |
|---|---|
| custom_mode | 整数0～8，Neo VIO状态，见下表 |
| rc_channel | 保存通道整数/null；配置损坏时关闭null |
| rc_available | bool；有效数据小于1秒，目标在线且非串口管理期间 |
| rc_ready | bool；可用且已确认稳定基准 |
| pulse_us | 最新有效整数/null；不可用必须null |
| position | low/middle/high/null，最近稳定区域；建立中/不可用null |
| last_action | null或最近串口来源动作，不含HTTP/按键历史 |
| last_action.source | command_long / rc_channels |
| last_action.action | start / stop / restart |
| last_action.result | in_progress / succeeded / rejected / failed |
| last_action.reason | null或上表小写码 |
| last_action.request_id | COMMAND_LONG编号1～65535；RC为null |

最近记录仅当前进程保留，不证明飞控在线。错误目标/语法/CRC不进入动作记录。完成回执有独立票据，后续HTTP动作不会把旧串口结果覆盖为另一次结果。

Neo HEARTBEAT每秒持续发送，状态变化补发；复用HTTP的状态计算规则，约100ms采样已有业务状态，进程存在性沿用既有500ms观察器，不新增高频扫描。type=18、autopilot=8，base_mode开启CUSTOM_MODE_ENABLED，不以SAFETY_ARMED表示VIO，不改变飞控flight_mode。

| custom_mode | 含义 |
|---|---|
| 0 | 已停止 |
| 1 | 启动中 |
| 2 | 初始化中 |
| 3 | 定位有效 |
| 4 | 定位暂不可用 |
| 5 | 停止中 |
| 6 | 重启中 |
| 7 | 状态未知/无新鲜数据 |
| 8 | VIO动作或运行异常 |

CALIBRATION_REQUIRED只是标定提醒，不据此判断无位姿。无新数据不伪造valid。


# 串口与 MAVLink

实现日期：2026-11-05。本模块不开放私有协议、解锁、起飞、模式切换或全量参数下载。源分支于 2026-11-06 已接实物 ArduPilot 4.6.2 验证搜索、身份及心跳状态；参数写入、重启和定位融合仍未验收。见[搜索修复验证](../HTTP-API-v3-飞控搜索修复-2026-11-06.md)。

## 串口所有者与版本

公开版设备服务的 MAVLink 线程通过 driverd IPC 独占使用 UART2（driverd 持有实际 TTY），持续发送 1 Hz 心跳。VIO 不再打开串口，只将已完成安装补偿、局部原点/航向对齐的有效 ODOMETRY 通过非阻塞本地数据报交给服务。

安装变换只做一次。HTTP 里程计依然以 IMU 为参考；串口参考点由安装配置确定。没有 VIO 新数据时只保留心跳，不重复最后位姿。转交携带发送端 monotonic 时间，超过 250 ms 的积压丢弃；服务最高约 30 Hz，低波特率进一步限制。管理过程不停止 VIO，也不参与算法计算线程的等待。

公开配置为 /home/VIO/parameters/mavlink.json：原子替换并同步至磁盘，只保存正式 baudrate/system_id/component_id/target_system_id。缺省 921600 bit/s、发送 system_id=1、Neo component_id=197，尚未绑定飞控；观察到的飞控 system_id 仍返回 null。首次通过搜索绑定，不静默迁移旧版 enabled/autostart。串口输出不要求飞控在线；搜索期间暂停里程计发送，VIO 正常计算，心跳继续。损坏配置拒绝管理写入，不静默覆盖。重复服务不会抢占已有本地里程计套接字。

## 五个 HTTP 操作

所有响应 Cache-Control: no-store。POST 严格 JSON，正文小于 4096 字节，要求 Content-Type: application/json 和 UUID Idempotency-Key。

Idempotency-Key 使用带连字符的 36 字符 UUID，例如 123e4567-e89b-42d3-a456-426614174000；32 字符连续十六进制不符合要求。公开网页在普通局域网 HTTP 页面使用 getRandomValues 生成标准 UUID v4；浏览器支持 randomUUID 时使用该方法。所有 MAVLink 管理和参数写入共用生成器。搜索按钮“自动搜索飞控”逐一尝试常见候选并识别飞控；失败后展开选择类型与手填波特率，不需要另一套搜索接口。

| 方法 / 路径 | 用途 |
| --- | --- |
| GET /api/serial/status | 当前模式与已接受的请求波特率 |
| GET /api/mavlink/status | 飞控实时快照、可选操作结果 |
| GET /api/mavlink/parameters?names=A,B | 按名称读取真实参数 |
| POST /api/mavlink/parameters | 修改一批参数，异步核对 |
| POST /api/mavlink | 搜索、取消搜索、通信/身份设置及重启 |

串口状态：{"mode":"mavlink","baudrate":921600}。baudrate 是当前已接受的配置请求值，不是物理线速测量。串口打开失败时 baudrate 为 null。飞控状态：

    {"connected":true,"flight_controller":"ardupilot","system_id":3,
     "flight_controller_component_id":1,"neo_component_id":197,
     "firmware_version":"4.5.7","flight_mode":"LOITER","armed":false,
     "active_operation_id":null}

目标飞控有效心跳间隔达到 3000 ms 即离线；串口故障/切换立即失效。其他系统/组件心跳不延长在线时间。armed 与 flight_mode 离线必须 null。类型、身份、固件是观测信息，离线可能保留历史值，网页明确提示。未知字段用 null，不能把未知 armed 当作 false。

flight_mode 是可扩展字符串，按家族/机型解码枚举，未知模式 null。目前含 PX4 主/自动子模式与 ArduPilot Copter/Plane/Rover 常见模式，不推测未知机型。固件来自 AUTOPILOT_VERSION，保留 dev/alpha/beta/rc 后缀。GET 状态只读快照，不放大协议查询。

## 操作、去重与并发

POST 受理返回 HTTP 202：{"accepted":true,"operation_id":"随机服务标识-序号"}，不代表执行成功。GET 状态可选 operation_id=... 或 request_key=UUID，不能同时提供。附加 operation 对象：

    {"operation_id":"...","action":"set_parameters","state":"failed",
     "error":"verification_timeout","result":{"parameters":{
       "VISO_TYPE":{"requested":1,"actual":null,"error":"verification_timeout"}}}}

state：running / waiting_reboot / succeeded / failed / cancelled。error 为代码或 null，result 随操作而定，无结果为 null。

- 32 条已完成记录，未完成操作单独保留，无时间过期。服务/Neo 重启后清空，ID 不重复，无持久化未完成摘要。
- 同 key＋规范化业务参数返回同 202；不同参数 409 idempotency_key_conflict。参数键顺序、1/1.0 不影响规范化。记录淘汰后不能去重。
- 一个管理流程，不排队，冲突 409 operation_busy，无需查询上次结果才允许下一项。
- 参数 GET 也占管理槽；状态 GET 始终可用。waiting_reboot 且旧链路在线允许参数 GET，允许对应重启继续，不允许其他写入。
- cancel_scan 与重启续接关联原记录。每记录最多 8 个请求键，超限拒绝，避免无限别名内存。
- 响应丢失先按 request_key 查询，网页不自动重发写入。404 operation_not_found 只代表结果未知。

## 参数

名称区分大小写，ASCII 字母/数字/下划线，1–16 字节；最多 32 个不同名称。GET 逗号分隔、去重、5 秒总期限，不保证原子快照。示例返回：

    {"parameters":{"VISO_TYPE":{"value":1,"type":"int8"},
     "MISSING":{"value":null,"type":null,"error":"timeout"}}}

收到任意参数回复时返回 200，包含逐项错误；全部未回复才返回 504。无在线目标 503，错误字段 400，并发 409。timeout 不等于不存在。收到类型但无法解码时保留真实 type，value 为 null，并明确 error。

POST：{"parameters":{"VISO_TYPE":1,"VISO_POS_X":0.02}}。不输入 type；10 秒总期限内先预读整批类型和值、整批检查，再逐项 PARAM_SET＋回读。已正确的值不写，首项失败停止后续，不回滚、不自动重发。每项 result 为 requested/actual/error，无法确认 actual 为 null，后续为 not_attempted；failed 不表示没有参数改变。不承诺飞控持久化或立即生效。

支持 MAV_PARAM_TYPE 8/16/32 位整数和 float32，依据能力声明选择 bytewise/C-cast。未知编码、不支持的 64 位类型、不精确可表示的 C-cast 整数拒绝。float32 按线上单精度值核对。通信/身份参数要求专用 action。

兼容 ArduPilot 旧能力声明：先检查显式 PARAM_ENCODE_BYTEWISE（16）和 PARAM_ENCODE_C_CAST（131072）；两者均未声明时，仅对已识别为 ArduPilot（autopilot=3）且声明 PARAM_FLOAT（2）的目标使用 C-cast。ArduPilot Copter 4.6.2 官方实现以 cast_to_float()/set_float() 传输参数，其整数也使用该方式。PX4/未知类型不因 PARAM_FLOAT 自动推断整数编码。读写共用此选择，边界校验不变；不能从数值猜编码。2026-11-06 实物 ArduPilot 4.6.2 的 42 项读取和网页显示通过，真实写入/保存/融合不在本次验证范围，见[验证记录](../HTTP-API-v3-飞控参数读取修复-2026-11-06.md)。

## 特殊 action

    {"action":"scan"}
    {"action":"scan","target_system_id":3}
    {"action":"scan","baudrate":123456,"expected_flight_controller":"ardupilot"}
    {"action":"cancel_scan","operation_id":"..."}
    {"action":"configure_link","port":"SERIAL1","baudrate":921600,"protocol":"mavlink2"}
    {"action":"set_system_id","system_id":3}
    {"action":"set_component_id","component_id":197}
    {"action":"reboot_flight_controller"}
    {"action":"reboot_flight_controller","continue_operation_id":"..."}

**自动搜索**：当前波特率、已保存波特率、以下常见候选去重后逐项搜索。每项 3 秒，最多 60 秒，至少两次同一飞控有效心跳。候选 bit/s：921600、115200、57600、230400、460800、500000、1000000、1500000、2000000、3000000、111100、256000、38400、19200、9600、4800、2400、1200。不支持的硬件候选跳过；这不是全部可设置整数值，也不代表每款飞控都支持。全部串口打开失败明确 serial_open_failed；已打开但未收到目标心跳为 flight_controller_not_found；期限内未完成候选为 scan_timeout。

**固定波特率尝试**：同一 scan action 附 baudrate，JSON 正整数 1–2147483647（请求编码边界，非硬件承诺）。底层通过 Linux termios2/BOTHER 设置，读取 PL011 的 uartclk/16 校验 16+6 位分频，先拒绝超范围值及超过 2% 的分频量化误差，核对内核接受值，不允许静默回退速率。当前实读 UART2 时钟 100 MHz，理论请求整数范围 96–6250000 bit/s；这不是该区间所有整数的实机收发验收。实际线速为 uartclk / (16 × (IBRD + FBRD/64))，受振荡器与物理链路影响。

单档等待有效心跳最多 10 秒，未收到为 fixed_baud_timeout；波特率无法设置为 baudrate_unsupported，其他串口错误为 serial_open_failed。可选 expected_flight_controller 只能是 ardupilot/px4，必须与 baudrate 同用；与真实心跳不符则 flight_controller_type_mismatch，并在结果中返回 detected_flight_controller，不按用户选择伪造识别。网页要求选择类型，API 允许省略类型预期。

两种搜索都沿用已绑定目标；显式 target_system_id 可指定新目标，省略不代表搜索所有系统。多个目标或已观测组件冲突明确失败。成功才保存 Neo 配置，结果含 baudrate/system_id/flight_controller。仅修改 Neo 尝试速率，不写飞控参数，不要求飞控重启。

失败或 cancel_scan 后最多额外 5 秒恢复原配置，不等待心跳。result.recovery 含 baudrate/restored/error；baudrate 是待恢复的原值，restored=true 才确认恢复。仅取消且恢复成功为 cancelled，恢复失败为 failed。普通失败保留首个原因，并另报恢复失败。不自动重试。请求 key 的规范化比较包含目标、速率、预期类型，32 条历史与单管理流程不变。服务重启加载已成功保存的自定义速率，未完成操作不持久化。

**通信配置**：port 为实际飞控端口。ArduPilot 4.x 使用用户选择的 SERIAL0…9，并读取 BAUD/PROTOCOL 检查存在性；波特率枚举 1/2/4/9/19/38/57/115/230/460/921/1500，不宣称 3000000 被此映射支持。PX4 1.x 的 TELEM1…3 必须从 MAV_0/1/2_CONFIG 读出唯一 101/102/103 映射，再用 SER_TELn_BAUD 与 MAV_PROTO_VER。无法确认返回 port_mapping_unknown。不通过心跳猜接线端口。协议仅 MAVLink 2，ODOMETRY ID 为 331。映射仍需真实固件验证。

写入核对 10 秒；需要重启则 waiting_reboot，无自动重启、无取消。手动重启或 continue_operation_id 沿同一操作继续；确认阶段最多 60 秒，必要时有限探测旧/新波特率。成功要求目标身份、链路和参数回读一致，再保存正式 Neo 配置。

**系统 ID**：修改整个飞控系统（AP SYSID_THISMAV / PX4 MAV_SYS_ID），核对后 Neo 跟随；组件不变。范围 1–255，拒绝已观测冲突。通常只需沿用。result 为 previous_system_id/requested_system_id/actual_system_id，不能确认则 actual=null。

对立即应用系统 ID 的固件，接收旧/新身份窗口内核对新心跳与参数即可完成，无需额外重启。等待重启时不会以新 ID 心跳单独冒充重启证据；若 UID 可用，也要保持同一飞控身份。修改 Neo 组件 ID 只保存组件本身，不能把前一次未核对成功的临时通信配置一并存盘。

**组件 ID**：只改 Neo，2–255，默认 197；拒绝 0、飞控保留 ID 1、已观测冲突。在完整报文之间切换并保存，不重启飞控/VIO。首次离线可预设，在线必须实时锁定。结果为 previous/requested/actual_component_id。

**重启**：新鲜锁定目标才能发 MAV_CMD_PREFLIGHT_REBOOT_SHUTDOWN，最多发一次。发送前最多 5 秒补取启动时间，发送后 60 秒总期限。ACK 拒绝立即失败；缺 ACK 不直接失败。成功须可信启动时间回退（排除 uint32 环绕/单个乱序），再确认两次稳定目标心跳。ACK accepted、断线重连、包序号回退均不能单独证明重启。无证据但在线为 reboot_unconfirmed；未恢复为 reconnect_timeout。result 含 command_ack/reboot_confirmed/reconnected。最终历史不被迟到重连重写。

2026-11-06 公开网页补充[重启反馈](../HTTP-API-v3-飞控重启反馈-2026-11-06.md)：第三步“验证接入”显示提交、受理、等待重连、结果核对及成功/未确认；按证据判成功，普通重启归入可选操作。通信配置 waiting_reboot 突出继续按钮，普通参数回读不推断重启要求。第二步先检查并应用修改，全部回读后才突出下一步，见[操作顺序](../HTTP-API-v3-飞控步骤与操作顺序-2026-11-06.md)。系统 ID 续接结果没有独立 reboot_confirmed 字段，不以操作成功冒充重启确认。本轮不改变 API 字段、板端判据或自动发送策略。

当前保守判据要求启动时间下降超过 3 秒，并在至少 100 ms 后再次观察到低位时间正常递增；重连心跳间隔小于 3 秒。刚启动不久就再次重启、缺少启动时间基线、只提供零值或乱序严重时可能无法确认，不能因此伪造成功。UID 原本可用时，重新请求并核对它；不接受另一 UID 的飞控替代原目标。

## 验证边界

模拟后端和用例位于 tmp/public-mavlink，不链接产品。独立 pymavlink 生成/解析真实报文，覆盖分片、尾零裁剪、参数类型、并发、去重和异常恢复。当前分支只构建公开产品，模拟器不进入产物。验证命令、部署结果另见验证报告。

真实飞控待验证：电平接线、流控、各波特率、AP/PX4 固件参数保存/生效规则、真实重启证据、定位融合。当前不支持签名验证，带签名或未知 incompat_flags 的帧不作为有效输入。飞控缺乏可靠启动时间时只能报告重启未确认。


## 公开网页飞控引导（2026-11-05）

网页复用本文接口，不增加模式切换、通信评分或融合检测接口。2026-11-06 公开源码按确认的原型改为“连接飞控、配置定位、验证接入”三步；接线准备见[设备接入说明](../飞控接线与接入.md)，连接页保留按需帮助。第二步对齐当前值与草稿、常显安装核对；写入范围在确认清单中勾选，未选草稿保留。源分支该布局曾部署 public-ff3a690f31b9，实机只读参数与页面检查通过，验证范围见[三步界面记录](../HTTP-API-v3-飞控三步紧凑界面-2026-11-06.md)。

- ArduPilot 4.3+（4.x）：EKF3、VISO_TYPE=1，独立编辑三组 EK3_SRCn_*；组按钮只切换编辑对象，不切换运行中的来源组。
- PX4 1.14+（1.x）：编辑 EKF2_EV_CTRL、EKF2_HGT_REF，推荐 EKF2_EV_NOISE_MD=1；噪声数值、延迟和未列出的位沿用读取值。
- 先读取再编辑，读取超过32项时串行分批；每次确认最多写32项，剩余草稿必须另行确认。写入结果未知时只按原请求键查询，不另发写入。失去操作记录后可显式结束本页跟踪并重新读取；不能将其当作取消或成功。
- 安装配置未保存时仍展示默认有效关系；飞控额外偏移不随推荐草稿清零，需用户确认重复补偿、生成草稿、再确认写入。
- 飞行模式只读。心跳在线、参数写入回读、估计器融合是不同事实；融合与运动方向仍需地面站检查。读回一致不代表飞控已持久保存或已应用需要重启的参数。
- 草稿仅在当前页面内存中保留，刷新、换设备或飞控连接/身份改变后失效，不恢复未完成修改。备份仅含本页首次成功读取的值及对应时间和类型。

主机验证、浏览器布局和实机边界见[飞控引导验证](../HTTP-API-飞控引导验证-2026-11-05.md)。

本次合并使用 /api 路径，字段定义见同目录 http-api.openapi.json。源分支历史验证与本次验收分开记录；安装配置支持 VIO 运行中保存，下次启动或重启生效。

## 固定速率搜索错误

以下是异步 operation.error；HTTP 202 仅表示受理。请求结构/类型不合法时仍同步返回 400 / invalid_request。

| code | 含义 |
| --- | --- |
| baudrate_unsupported | 固定速率请求无法由当前 UART 接受，包括硬件范围/驱动能力不支持 |
| fixed_baud_timeout | 固定速率等待目标心跳超时 |
| flight_controller_type_mismatch | 已识别的飞控类型与 expected_flight_controller 不符 |
| serial_open_failed | 固定速率尝试时串口未能打开 |
| serial_restore_failed | 原串口配置恢复失败；见 result.recovery.error，取消搜索且恢复失败时也为 operation.error |

结果中的 baudrate 和 recovery.baudrate 是请求/配置速率，不是物理线速测量。错误名称及新增字段与同目录 OpenAPI 一致；实际错误响应不附带文档说明文本。

系统重启并发约束（2026-11-09）：MAVLink 管理命令与参数读写在系统重启已受理或重启状态存储异常时返回409 REBOOT_BUSY；先查询[系统状态](HTTP-API-系统.md)，不自动重复变更。普通状态查询保持可用。

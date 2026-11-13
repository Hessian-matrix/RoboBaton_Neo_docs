# ：TF 录制、数据管理与卡监控

本次仅。本次不开放灰度网络流、相机标定快照 API、性能录制或回放。TF录制/管理7项，预检另增2项，合计13个方法/路径操作。

## 操作与状态

| 请求 | 用途 | 成功返回 |
|---|---|---|
| POST /api/recording | start / stop | 202：action、accepted=true、recording_id |
| GET /api/recording | 当前任务 | starting / recording / saving；没有任务时仅 state=idle |
| GET /api/monitor | TF 卡状态及容量 | tf_card |
| GET /api/datasets?limit=20&offset=0 | 历史目录 | datasets、next_offset |
| GET /api/datasets/{id} | 某次录制详情 | id、channels、config、current、result |
| GET /api/datasets/{id}/archive | 下载归档 | application/x-tar，流式传送 |
| DELETE /api/datasets/{id} | 删除单条 | 删除实际完成后 204 |

请求正文为 application/json，必须有 Content-Length。命令必须包含 Idempotency-Key，最多96个字母、数字或 _.:- 字符。同键同请求在同一进程内10分钟重复返回原受理结果；同键不同内容409。缓存32项，满时503，服务重启后不保留。因此客户端网络错误应复用键重试，不应把重试变成新录制。POST 正文上限512字节，不支持 chunked 请求正文。

启动示例：

    {"action":"start","channels":["gray","imu","color","odometry"]}

channels 缺省为 gray+imu；至少一路，不允许重复或未知名称。gray 是544×640 JPEG Q90，实际采集约60fps；imu 是逐样本真实时间和序号；color 沿用已生效的1080×1280 MJPEG/H264/H265配置；odometry 需要 VIO 已经启动，本接口不自动启动算法。配置冲突、无卡、只读409；剩余空间不足512MiB为507；资源不足503。

受理示例：

    {"action":"start","accepted":true,"recording_id":"cc8380b1aadfb3d455e79f42b9c872ca"}

202不等于源已连接或写卡成功。服务冻结mono.conf后建立任务，再异步连接各路板内源。停止必须提交该ID：

    {"action":"stop","recording_id":"cc8380b1aadfb3d455e79f42b9c872ca"}

当前状态示例：

    {"state":"recording","recording_id":"cc8380b1aadfb3d455e79f42b9c872ca",
     "channels":["imu"],"duration_s":4.690,"bytes_written":"243174",
     "counts":{"gray":"0","imu":"907","color":"0","odometry":"0"}}

counts 是成功 fflush 后确认的完整记录数；bytes_written 是RBR段文件字节（含文件头、配置、记录头、结束记录），不包含mono.conf/manifest/result。计数不是接收数或排队数，也不是断电后可保证持久的数量。约100ms刷新；每约1秒或新增完整写入达到1MiB时请求后台fsync，同一时刻仅一个fsync在途，后续请求合并；实际完成延时由文件系统决定。saving时接收已停止、duration_s固定，写卡线程继续排空队列，因此计数可继续增长。

idle只表示当前没有任务，严格不携带旧录制结果。网页记住受理ID，结束后查询对应datasets详情；网络重连后也可从列表查询。浏览器断线不停止录制；只有明确stop、源异常、空间不足、队列溢出或服务退出等才收尾。

## 卡监控

    {"tf_card":{"state":"ready","total_bytes":"7930380288","available_bytes":"6455463936"}}

| state | 含义 |
|---|---|
| ready | TF 文件系统已挂载且可写 |
| missing | 控制器明确报告未插卡 |
| unmounted | 已有TF块设备，目标路径尚未挂载 |
| read_only | TF文件系统已挂载为只读 |
| unavailable | 初始化失败、状态不可确定，或容量读取失败 |

不可把“没有块设备”当成“未插卡”，例如pluged_init_failed为unavailable。容量只读取实际/dev/mmcblk*挂载到/mnt/tfcard的文件系统；不以根分区容量代替。无法确认时两项为null。available_bytes是操作系统可用字节，不扣512MiB预留；空间不足是录制拒绝或结束原因，不增加卡状态枚举。网页在运行监测展示容量。

## 文件系统与挂载条件

匹配的系统镜像支持 FAT32 和 exFAT，系统服务在开机或检测到插卡后只读检查，再挂载到 /mnt/tfcard。应用本身不加载文件系统驱动。支持唯一 SD 卡的单一 p1 分区或无分区表的文件系统；多分区、未知格式、检查失败、未正常卸载标志或挂载冲突不自动写入，也不自动修复或格式化。

检查期间及拒绝挂载时，已有块设备返回 unmounted，容量为 null；本次不新增细分原因字段。录制启动返回 409 / STORAGE_NOT_READY。只在挂载完成且可写时返回 ready。检查有 120 秒上限，失败不会在同次插卡期间无限重复，重新插卡或重启后重新检查。

插拔不自动继续上一次录制。拔卡导致旧挂载失效，现有录制可能不完整；新卡检查通过后需要重新发起录制。停止录制不等于文件系统已经安全卸载，请正常关闭设备后拔卡；当前没有开放安全弹出 HTTP 操作。FAT32 单文件上限为 4GiB−1 字节，录制沿用约 256MiB/60秒分段。容量上限及具体卡型需实卡验收，不能从 exFAT 支持推导。

2026-11-10 验证边界：8GB FAT32 实卡录制、安全卸载后的真实拔插、两次最终系统 OTA 重启后挂载，以及板端 exFAT 临时 loop 卷读写。后续当前8GB exFAT实卡完成灰度60fps+IMU200Hz三轮3/10/3分钟连录、归档完整性校验、只读fsck及两次正常固件OTA后自动挂载，详见[实测报告](../TF写入积压与exFAT实测-2026-11-10.md)。当前写入修复尚未换回FAT32卡复测，录制中强行拔卡及大容量卡仍未验收。拔卡后若供应商控制器状态仍滞留 plugged，现有接口保守返回 unavailable；不会误报可写，插回并完成检查后恢复 ready。历史旧镜像不具有此次新增支持。

## 数据管理

仅列举/mnt/tfcard/recordings中的32位小写十六进制随机ID。旧/mnt/tfcard/euroc不迁移、不伪装为RBR1。ID按字典序分页，不代表创建时间；并发增加/删除时offset可能变化，需重新刷新。单页1..100项，目录上限10000条。当前列表是小规模TF目录的实现，不是无限容量索引。

每个列表项含id、channels、result、current。录制中result=null，current是当前状态；结束后current=null，result携带completed/incomplete、complete、end_reason、duration_s、bytes_written和counts。详情另含config。启动未完成配置冻结时color可为null，不能猜用当前设备配置。

结束原因包括user_stop、empty_channel、interrupted、service_shutdown、source_unavailable、vio_unavailable、resource_unavailable、snapshot_failed、source_failed、source_timeout、data_gap_or_source_error、queue_overflow、random_access_timeout、write_failed、storage_unavailable、storage_full。只有所有选定通道有记录、连续性检查通过且文件成功收尾才complete=true。

目录恢复、下载、删除、开始操作相互排他；录制/保存期间仍可查询状态和详情，但不允许TF下载删除。下载中也不能开始新录制。下载不把整个归档装入板端内存，不重新压缩JPEG/H26x；首版Range返回416，最多4096段。慢或断开的下载连接会释放锁。浏览器无文件流写入能力时使用原生下载，避免把整个tar装入网页内存。

现有公开下载保持完整 GET，Range 仍返回 416 / RANGE_UNSUPPORTED，中断后从头重试；本次不新增 HEAD、归档 ETag 或网页暂停／继续功能。此决定不改变实时流重连和中断录制恢复。

DELETE只接受一个确切ID，拒绝路径穿越、符号链接、目录中的未知文件；不递归清空任意路径。失败可能已删除部分文件，应重新查询；仅成功才204。

## 写入与恢复

2026-11-10：支持 KEEP_SIZE 的文件系统仍为每段预分配256MiB。Linux 5.10 exFAT没有该能力，只有明确识别为exFAT且返回EOPNOTSUPP时允许空文件顺序增长，不写零、不用稀疏长度伪装已分配空间；ENOSPC/EIO及其他文件系统错误继续拒绝。保留启动空间检查和运行中剩余空间保护，但exFAT不承诺启动时已占有整段空间。8MiB未确认写入预算与8MiB应用队列不变：预算满时等待足够的已同步前缀，不再强制等待同步线程完全空闲；切段/停止仍等待最终完整同步。写线程显式分配256KiB stdio存储并跨段复用，修正musl下NULL缓冲参数没有扩大默认缓冲的问题。跨次重启的恢复和不完整标记语义不变。

正式目录结构：

    recordings/<id>/manifest.json
    recordings/<id>/mono.conf
    recordings/<id>/segments/000001.rbr
    recordings/<id>/segments/000002.rbr.part
    recordings/<id>/result.json

录制接收与写卡分离。板内源依次使用gray46008、IMU46006、color46009、odometry46012；不使用低优先级的公开IMU46013。沿用驱动VIO优先的数据分发顺序，TF写线程nice=5，网络外发nice=10。不是硬实时调度保证；VIO仍会受共享CPU/DDR/存储影响，应以并发实测判断。

队列上限8MiB且不超过4096条，启动要求至少20MiB MemAvailable。不会无限缓存，也不以丢帧方式伪装完整录制；队列溢出停止接收、保留前缀并报告incomplete。图像和IMU序号必须连续，epoch变化终止该任务。各通道按接收顺序写入，不承诺全局时间排序。单条视频限制约2MiB，异常长度不分配无限内存。

约256MiB或60秒触发切段；完整记录不跨段。H26x等到参数集齐全的IDR并在新段写入其前置参数集，主动请求IDR，等待最多10秒。实际段长度可略大于阈值。每段均重复冻结的配置JSON，mono.conf位于同一归档；不能脱离mono.conf将单段视为完整标定数据集。彩色录制订阅46009持有编码配置锁；录制期间修改冲突由原彩色控制接口409拒绝。

每段先以.part写入，结束记录、flush/fsync成功后改名.rbr并同步目录。result.json使用临时文件+rename。服务重启或重新挂卡后，缺result的目录逐段扫描CRC，只信任编号连续的完整记录前缀；永远标interrupted/incomplete，不因结束标记齐全推断正常完成。恢复不修改part原文，未知的断电时长为null。若某段损坏，忽略之后各段；下载仍保留原文件供诊断。存储损坏导致manifest无法识别的目录不会冒充可用数据，需线下处理。

## RBR1 字节定义

所有整数小端，绝不直接序列化C结构体。CRC32为IEEE多项式0xEDB88320，与zlib.crc32一致；它用于检错，不是签名。

| 文件头偏移 | 字节 | 含义 |
|---|---:|---|
| 0 | 4 | ASCII RBR1 |
| 4 | 2 | 版本1 |
| 6 | 2 | 固定头长度64 |
| 8 | 4 | 段号，从1开始 |
| 12 | 4 | 配置JSON字节数，1..8192 |
| 16 | 32 | ASCII录制ID |
| 48 | 12 | 保留，全零 |
| 60 | 4 | CRC，覆盖头前60字节+随后配置JSON |
| 64 | 可变 | UTF-8配置JSON，和manifest一致 |

随后为逐条记录：

| 记录头偏移 | 字节 | 含义 |
|---|---:|---|
| 0 | 2 | type：1数据、2事件预留、3段结束 |
| 2 | 2 | channel：gray5、imu3、color4、odometry2；非数据为0 |
| 4 | 4 | metadata字节数，1..8192 |
| 8 | 4 | binary payload字节数，0..2097152 |
| 12 | 4 | CRC，覆盖头前12字节+metadata+payload |
| 16 | 可变 | UTF-8 metadata对象，然后binary payload |

metadata对IMU、里程计为source_epoch十进制字符串和data（现有v3单样本/里程计结构）；IMU保留真实逐样本seq、sec/nanosec及m/s²/rad/s，不为缺失温度虚构值。图像另有stream_epoch、source_id_legacy，data是现有彩色v3 header/pts_us/random_access；source_id_legacy只是旧驱动提供的值，不能当sensor ID。灰度JPEG的pts_us=null。H26x二进制为Annex B的一AU，随机访问由NAL检查，不凭普通I帧标志判断；无B帧性质仍以既有编码约束及实测边界为准。

离线读取：python tools/http-api/recording_rbr.py <解包后的id目录>。该工具只读，报告完整前缀、计数、错误段和最终完整性；不把.tar直接作为RBR文件读取。格式测试及实机范围见同目录TF验证报告。


## 录制预检与实时卡速率（2026-11-03）

GET /api/monitor 新增 read_bytes_per_sec/write_bytes_per_sec，来自整卡块设备统计，约1秒采样。
GET /api/recording/check?channels=gray,imu 查询当前配置的内存结果；POST同路径以start/channels启动，以stop/check_id取消。
默认采集30秒，再等待写入同步收尾；同卡本次连接可保留多组结果，切回原配置可复用。服务/系统重启、卡拔插/掉线/挂载代次改变后失效。
预检与正式录制互斥；测试期间VIO及彩色配置修改返回409。结果不保证长期稳定，详见[预检说明](HTTP-API-TF预检.md)。

录制开始使用统一有效标定参数快照：合法 mono.conf 优先，仅文件不存在时使用完整默认值。归档 mono.conf 保存本次快照，manifest.json 的 calibration_source 为 default 或 saved；default 不表示设备已标定，不回写设备参数目录。文件损坏仍导致快照失败。

系统重启并发约束（2026-11-09）：本模块的业务变更/配置写入在系统重启已受理或重启状态存储异常时返回409 REBOOT_BUSY；先查询[系统状态](HTTP-API-系统.md)，不自动重复变更。普通状态查询保持可用。

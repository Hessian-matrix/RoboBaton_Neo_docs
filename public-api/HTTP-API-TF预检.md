# ：TF 录制预检与实时读写速率

预检复用正式 TF 录制接收、JPEG Q90 编码源、RBR1 文件、8 MiB 队列、顺序写入与同步策略，不使用随机数据跑卡速榜单。

预检与正式录制互斥。即使录制完整，同步耗时达到风险阈值仍报告 risk。

## 使用与生命周期

切到 TF 录制，选择灰度、IMU、彩图、里程计中的内容，点击开始录制上方的“检测当前配置 · 约30秒”。不强制预检后才能录制。里程计要求已启动 VIO，检测不会自动启停 VIO。

收到所有所选数据源后开始30秒计时；来源准备有10秒超时。结束后继续排空队列、同步并清理本次临时目录，所以总耗时可能超过30秒。期间可以取消，但仍需安全收尾。关闭网页不取消板端任务。

临时文件位于 TF 挂载点的 .robobaton-preflight/<check_id>，不会进入 recordings 或数据管理列表。复用目录文件白名单清理，不递归删除未知内容。服务中断留下的、身份有效的 RBR1 临时目录在下次识别卡且录制资源空闲时清理；未知/残缺目录不擅自删除。清理失败会报告 cleanup_failed，不会假报通过。

预检、正式录制、归档下载和数据删除互斥。检测期间 POST /vio、POST /color/config 返回409；GET配置及预览可用。外部进程/按键造成的 VIO 状态变化也会中止本次有效性判断。

## 接口

POST /api/recording/check，请求头 Content-Type: application/json 与 Idempotency-Key：

    {"action":"start","channels":["gray","imu"]}

默认channels为gray+imu。受理HTTP202：

    {"action":"start","accepted":true,"check_id":"0123456789abcdef0123456789abcdef"}

取消使用 {"action":"stop","check_id":"…"}，返回同结构的stop受理结果。202不等于测试通过；请求传输失败应复用同一幂等键。与正式录制区分请求类型，不能跨接口复用键。进程内10分钟/32键；不对重复请求重新开任务。

GET /api/recording/check?channels=gray,imu：

- state：untested/testing/saving/passed/risk/failed/incomplete，针对所请求的当前配置。
- configuration：板端解析的规范化配置，无法可靠读取则null。通道顺序固定，不因网页勾选顺序不同而重复检测。
- active：全局活动任务，包含check_id、testing/saving、configuration、elapsed_s和target_duration_s=30；没有任务为null。即使查询另一配置，也可发现已有任务。
- result：匹配当前配置的最近完成结果，未检测则null；含counts、bytes_written、duration_s、各通道实际rates_hz、reason及metrics。测试进行中可以带上同配置上次结果，网页优先显示正在检测。

错误：400非法字段/通道/ID，408请求未完整送达，409资源占用/卡不可写/VIO未运行/配置锁定/幂等键冲突，503内存、配置、卡身份或缓存容量不可用，507空间不足。完整schema见 http-api.openapi.json；Python示例见 Device.recording_check/start_recording_check/cancel_recording_check。

## 检测判定

这些是本次实现的明确阈值，不是存储卡厂商保证：

| 结果 | 判断 |
|---|---|
| passed | 完成30秒、源连续、所选通道有数据且达到规定速率、无下列风险 |
| risk | 数据最终完整，但队列峰值达到75%，采集结束积压达到25%，或单次write/flush/sync至少500ms，或收尾排空至少2秒 |
| failed | 队列溢出、数据缺口、写入/清理失败、空间不足等 |
| incomplete | 取消、条件变化、卡连接变化、数据源不可用或未达到测试速率等 |

灰度/IMU/彩图源时间跨度内的输出速率需至少达到配置期望的90%。灰度无VIO按60fps，有VIO读取驱动配置capture_fps；IMU200Hz；彩图取实际配置fps。里程计受算法情况影响，不承诺固定30Hz，只验证源连续、有样本并报告实际到达速率。速率不足不能判为卡性能差，也不能以较低实际输入量判为通过。

metrics：queue_peak_bytes、queue_end_bytes、queue_capacity_bytes、write_max_ms（单条RBR1序列化/写入墙钟耗时）、flush_max_ms（写入确认）、sync_max_ms（持久保存确认）、drain_ms。每段分别计时，仍会包含调度等待，不等于闪存本体耗时。当前预检不单独测JPEG编码耗时，无法仅凭本结果完全定位存储硬件/驱动/CPU根因。

## 内存缓存与卡身份

匹配键包含所选通道、灰度分辨率/质量/帧率、IMU频率、彩图分辨率/编码/质量或码率，以及VIO是否运行。无关未选通道的录制参数不加入键。已有A、B两组结果时，A→B→A直接取回A；不将高码率通过自动推断成低码率通过。正常刷新、切换浏览器不丢失。

每个卡连接代次最多保存128组结果（约百KB量级）；不偷偷淘汰已测结果，达到上限只拒绝新配置，已测配置可查询与重测。没有结果文件、localStorage或配置持久化。服务进程/系统重启自然清空。

卡拔插、换卡、掉线或重新挂载均使旧预检结果失效；身份未确认时不复用结果。

## 实时读写速率

GET /api/monitor 的 tf_card 提供 read_bytes_per_sec、write_bytes_per_sec，类型为 number 或 null，表示整卡读写字节速率，包括录制、下载等活动，约每秒更新。

空闲为0，首次采样、计数倒退、不支持、卡不可用或样本超过3秒为null。显示当前吞吐，不代表持续峰值、最低保证或掉电持久性。所有预检结论仅适用于被测负载的短时结果；正式录制仍实时检查卡与空间。

实测证据及未验证范围另记验证报告，不把编译通过当作全部验收通过。



系统重启并发约束（2026-11-09）：本模块的业务变更/配置写入在系统重启已受理或重启状态存储异常时返回409 REBOOT_BUSY；先查询[系统状态](HTTP-API-系统.md)，不自动重复变更。普通状态查询保持可用。

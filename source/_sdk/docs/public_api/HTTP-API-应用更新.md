# 应用更新

当前布局为 system-ab-2（flag 512 KiB、TEE 16 MiB）。旧 system-ab-1 包不兼容；旧布局到新布局必须全量烧录，普通 OTA 不迁移分区。

2026-11-09。保留状态查询、上传和安装；重启统一由[系统接口](HTTP-API-系统.md)执行。当前支持本地签名包；尚无服务器版本源、自动下载或自动安装。验证结果见测试记录，不将编译通过当作板卡验收。

## 责任划分

- Web 网关：HTTP 上传接收、上传字节进度、静态页面和查询转发。
- device-service：候选包、空闲检查、维护状态、持久操作记录、启动升级器。
- 系统升级器：签名、镜像清单与兼容校验，写备用 kernel/data 并完整回读，提交试启动记录。没有新增常驻进程。
- NDS1 只传控制和文件句柄。ND_UPDATE_UPLOAD 首次响应通过 SCM_RIGHTS 授予唯一 incoming 文件 fd；网关写完并关闭后在同一连接发送单字节 D，设备服务校验后返回最终 NDS1 JSON。失败/断连释放租约。既有下载目录 fd 语义不变。

更新目录 /home/.robobaton-update 由系统挂载到持久 user 分区，0700；文件0600。不依赖 TF 卡。
仅支持 system-ab-2 签名包。旧目录交换与 neo 布局包已移除，不更新 U-Boot、env、TEE 或用户数据。
系统标识或更新器缺失时 available=false，上传/安装返回503 UPDATE_UNAVAILABLE，不回退旧流程。
试启动期间飞控串口服务暂停；系统健康确认后设备服务自动核对并恢复串口，无需客户端持续查询本接口。确认前仍保持维护锁。

## HTTP

### GET /api/update

返回 HTTP 200，完整结构见 OpenAPI UpdateStatus：

| 字段 | 内容 |
| --- | --- |
| running | 当前设备服务编译时的 version、build_id；未标记构建为 null |
| gateway_running | 当前网关的 version、build_id；未知为 null |
| installed | 磁盘最近安装回执，package_id 与 metadata；未知为 null |
| package | 已校验候选，package_id 与 metadata；没有时 null |
| operation | 最近操作的 operation_id、state、package_id、error；没有时 null |
| maintenance | 是否限制任务及配置变更 |
| upload | received_bytes、total_bytes；未上传/校验时 null |
| limits | max_package_bytes、free_bytes、reserve_bytes、package_format |
| available | 更新状态存储是否可用 |

running 不从新目录版本文件推测。磁盘安装回执与运行身份分开，允许安装后仍运行旧程序。这里的身份针对设备服务和网关，不能代替硬件实测。succeeded 要求跨 boot、设备服务 build_id 匹配，并通过系统 A/B 身份及健康确认；完整功能验收另外执行。

metadata 字段：format=2、minimum_updater=2、product=RoboBaton-Neo、hardware=robobaton-neo-board1、arch=armv7-softfp、edition=public、layout（固定 system-ab-2）、key_id、trust（production/test）、version、build_id、notes、payload_bytes、installed_bytes、payload_sha256。字节数为不超过512MiB的JSON整数，SHA256为64位小写十六进制。build_id 标记冻结的实际构建；包含未提交源码时不得只填 HEAD 冒充。

operation.state：accepted → installing → reboot_required → rebooting → succeeded。明确确认未激活的失败为 failed；切换结果不确定、运行身份不匹配为 recovery_required。error 为 null 或仅含 code 的对象。恢复待核查时不重复安装、不自动解除维护。

### POST /api/update/package

原始 .viofw 字节，Content-Type: application/octet-stream，必须提供唯一 Content-Length。不接收 multipart、chunked、Expect，也不提供断点续传。

最大512MiB是协议资源上限，不是可用空间承诺。上传前至少预留两倍包大小 + 4MiB余量，保留接收与候选状态的保守空间余量；安装另检查4MiB余量，不复制旧应用目录；不清理用户数据腾空间。上传15秒无进展或总600秒超时即结束；校验单独最长180秒。

成功 HTTP 200：

    {"package_id":"完整 VFW2 文件 SHA256","metadata":{...}}

网关边收边写，内存块64KiB；板端签名/文件校验和落盘后才返回200。浏览器100%后显示校验阶段，不当成安装成功。仅支持一个候选、一个上传；失败替换保留原候选。服务重启重新核对候选完整包哈希，描述与文件不一致不接受。

### POST /api/update

Content-Type: application/json；Idempotency-Key 为1～96个字母、数字或 _ . : - 字符。

    {"action":"install","package_id":"已校验候选的完整 SHA256"}

重启改为 POST /api/system/reboot，正文 {}，使用独立 Idempotency-Key。本接口只允许 install；旧 reboot 动作及 operation_id 字段返回400 INVALID_REQUEST，不兼容。

HTTP 202：

    {"operation_id":"32位十六进制标识","state":"accepted"}

受理前持久保存操作与 key。同 key/动作/目标返回原操作 ID，不再次执行；异内容409。系统重启在受理时关联当前安装操作，重启 key 与安装 key 独立存储。最多128个持久 key，满后503，不自动淘汰；只查询最近操作，不新增通用任务接口。结果未确认先 GET，不能换新 key 盲重试。

错误统一 {"error":{"code":"..."}}。HTTP：400请求不合法、408上传/正文超时、409工作中/捕获租约/维护/键冲突、413包超上限、422包校验失败、500状态保存失败、503设备不可用/结果未确认/记录满、507空间不足。

## 维护与并发

第一版上传也要求空闲，避免写盘挤占 VIO/TF。录制、收尾保存、预检、VIO运行/控制、按键动作和 MAVLink 活跃操作阻止更新。所有设备变更共用 pr_actions 准入；实体按键在实际执行时复查，不只禁用网页按钮。

灰度、IMU、彩图及下载持有捕获租约。安装检查与进入维护通过跨进程 admission 锁衔接，防止检查后新开连接。普通预览和空闲里程计订阅可存在，维护开始后网关关闭它们；VIO 运行本身已阻止安装，因此不会截断正在产生的里程计。其他采集/下载不被强制截断，而是拒绝安装。公开网页进入更新页释放自己的里程计显示订阅，离开后恢复。页面在本地采集/求解/保存参数期间拒绝更新；其他浏览器脱离板端的纯计算不能由板端识别，但仍连接的数据采集受租约保护。

安装期间 MAVLink 工作线程停止，配置不能修改。网关与设备服务留在维护状态供查询及重启。备用槽安装后未重启不启动新任务，不自动重启。设备服务正常退出等待更新线程；异常退出留下持久阶段，下次启动只核查，不重放。

## VFW2 与信任

| 顺序 | 长度 | 内容 |
| --- | --- | --- |
| 1 | 4 | ASCII VFW2 |
| 2 | 4 | metadata字节数，u32大端，1～8192 |
| 3 | 上述长度 | UTF-8 JSON metadata原始字节 |
| 4 | 64 | Ed25519签名，覆盖前面8字节头和metadata原始字节 |
| 5 | payload_bytes | VFW1清单及文件，完整SHA256等于metadata.payload_sha256 |

签名验证不重新序列化 JSON。打包器使用 UTF-8、sort_keys、无缩进，接收方验证实际字节。VFW1内清单固定包含 uImage、data.ubi 两个镜像，校验名称、权限、长度与SHA256；拒绝额外、重复和越界项，内容总长度必须与签名元数据一致。

package_id 是完整VFW2的SHA256，不写入包自身。API只使用完整包摘要。安装回执由升级器计算完整摘要后写入，不从请求复制未经核对的值。

公钥预置 /etc/robobaton/update-keys/production/<key_id>.pem，私钥留在发布环境。支持多个已配置ID；未知key拒绝，不信任包内公钥。默认构建只接受production。实测升级器通过 NEO_UPDATE_TESTING=1 显式构建，只接受keys/test下测试公钥；测试包在页面标记，正式构建拒绝。包不能修改信任目录，HTTP不能切换信任类型。

签名库为固定 OpenSSL 3.5.9 LTS 静态libcrypto，Apache-2.0；下载校验值固定在 tools/firmware/build-crypto.sh。只有系统升级器链接签名库，应用转发入口不链接。

## 构建与恢复边界

应用 CI 生成 ARM 构建归档与系统集成素材，不再生成 neo 目录更新包。配套 SDK 的
cv610-board/robobaton-current/build-production.sh 组装系统，ab/package-system.py 生成签名 system-ab-2 包。
原始 tar.gz 与 system-bundle 不能直接上传。私钥由发布环境提供，不进入归档。

首次分区迁移仍需独立烧录。日常更新走下面的 A/B 流程，用户标定、配置与 TF 数据保持。
不再创建 .VIO-previous 或 .vio-updater-rescue；自动回退依靠系统槽和启动记录。
真实掉电验收单列，普通重启不能替代。未知状态保留候选与维护标识，不绕过保护。

## 系统 A/B 安装（2026-11-06）

固定 /etc/robobaton/system-ab 标识存在时，独立升级器转交固定 /bin/neo-system-update；请求不能选择程序。
上传及安装路径、返回字段和安装幂等规则不变；重启路径见系统接口。只接受 system-ab-2，旧目录安装入口已删除。
系统包只包含匹配的 uImage 与 data.ubi；同一份元数据签名和载荷哈希绑定两者。整包不超过 32 MiB，kernel 不超过 16 MiB，data 不超过 8 MiB 且按 128 KiB 对齐；HTTP limits.max_package_bytes 仍是通用的 512 MiB 上限，系统后端还会做更严格检查，违反时 PACKAGE_INVALID。
系统上传仍保留两倍包空间和 4 MiB 余量；安装直接写备用槽，不复制当前应用目录，另检查备用 NAND 好块容量。
安装只写非当前 kernel/data，备用 data 被 UBI attach 时拒绝；逐页回读核对后保存收据并提交 NAND 试启动记录。不刷 boot/env/TEE/user，设备配置保留。
metadata.build_id 为完整应用 SHA、点号、完整 SDK SHA；running/gateway_running.build_id 仍是应用 SHA。
跨 boot 后核对实际联合版本、收据 package_id 和系统确认记录，才进入 succeeded。试启动待确认期间为 rebooting 并保持 maintenance；最多 3 次未确认回退旧槽后为 failed，error={"code":"UPDATE_BOOT_FAILED"}。未知状态不自动解除维护。
测试镜像只接受配套 test 公钥，正式镜像只接受指定 production 公钥。正式信任目前尚未建立。
2026-11-07 新板全量首刷、真实 HTTP 上传验签、备用槽写后回读、HTTP 自动重启与 B 槽健康确认通过。真实掉电/坏块故障注入、内存长稳和 VIO/深度共载仍未验收；当前无 FIT 强制验签或核心加密，正式信任未建立。详见 ../A-B系统更新接入.md。

板型标识迁移：最终包 hardware 固定为 robobaton-neo-board1，旧板型被拒绝。已安装旧校验器的开发设备需先安装一次性过渡签名包，再安装新标识包；过渡时更新状态会如实显示旧包元数据，不伪造已签名内容。两步操作分别完成启动确认后才能继续。

网络切换正在执行时，更新上传/安装准入返回 409 UPDATE_BUSY；已进入更新流程时，网络修改返回 409 UPDATE_BUSY。

2026-11-09 可控故障回退实机通过：故障包仅停止HTTP网关自启，三次试启动后自动回旧槽，更新failed/UPDATE_BOOT_FAILED、系统重启succeeded、maintenance=false；随后正常OTA恢复通过。该场景不覆盖掉电、坏块或内核卡死，详见[可控故障回退验收](../可控故障回退验收-2026-11-09.md)。

配套 SDK 的 A/B 确认增加连续业务健康条件（见[业务健康与系统看门狗](../业务健康与系统看门狗.md)）；VIO 初始化成功不作为确认前提。仍只接受 system-ab-2，重启统一走 /api/system/reboot。本次源码整合未构建或部署，不能据此确认旧 U-Boot/env 可直接接收新系统 OTA。

# 系统状态与重启

本接口重启 RoboBaton Neo 板卡，不重启外接飞控。2026-11-09已完成ARM构建与板卡OTA验收。普通重启、占用拒绝、跨boot去重及新接口OTA激活通过，范围见[验证记录](../系统重启接口验证-2026-11-09.md)。

## GET /api/system/status

不带查询参数或正文，返回 HTTP 200：

~~~json
{"boot_id":"00000000-0000-4000-8000-000000000001","available":true,"reboot":null}
~~~

最近一次请求执行完成后的示例：

~~~json
{"boot_id":"00000000-0000-4000-8000-000000000002","available":true,"reboot":{"request_id":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","boot_id":"00000000-0000-4000-8000-000000000001","state":"succeeded","update_operation_id":null,"error":null}}
~~~

| 字段 | 含义 |
| --- | --- |
| boot_id | 当前 Linux 启动 UUID，来自 /proc/sys/kernel/random/boot_id；初始化或状态恢复失败时为 null |
| available | 重启管理及持久存储已初始化；不是“此刻业务空闲”的承诺，准入以 POST 为准 |
| reboot | 最近一次重启请求，无请求或无法可靠恢复记录时为 null |
| reboot.request_id | 32 位小写十六进制请求标识 |
| reboot.boot_id | **受理时**的启动 UUID，不能当成当前 boot_id |
| reboot.state | accepted、rebooting、succeeded 或 failed |
| reboot.update_operation_id | 重启所关联的 OTA 安装操作 ID；普通重启为 null |
| reboot.error | null 或仅含 code 的对象 |

accepted 表示已持久受理；约 1.5 秒后进入 rebooting 并尝试同步文件系统、执行固定 /sbin/reboot。命令执行最长等待 5 秒；退出成功但再过 10 秒本进程仍运行，则记 REBOOT_FAILED。这些期限不包括系统存储同步的阻塞时间。HTTP 响应丢失不会取消已受理请求。

正常关机过程中会先停止设备服务。收到服务退出信号后，重启线程保留 accepted/rebooting，不执行超时失败判定，也不在退出时补执行重启命令；由下次服务启动核对 boot_id。同 boot 重启服务记 REBOOT_INTERRUPTED，真正跨 boot 才记 succeeded。

仅在下次设备服务启动时观察到 boot_id 改变，才把尚未结束的请求记为 succeeded。这证明期间发生过系统重启，不能区分接口重启和人工断电，也不代表 OTA 已成功或算法正常。重启前已明确失败的记录不会因之后无关重启变成成功。

## POST /api/system/reboot

Content-Type: application/json；正文必须为 {}，无 action、force、operation_id 或其他可选参数。必须携带 Idempotency-Key（1～96 个字母、数字或 _ . : -）。不接受查询参数。

~~~http
POST /api/system/reboot HTTP/1.1
Content-Type: application/json
Idempotency-Key: restart-20261109-001
Content-Length: 2

{}
~~~

成功 HTTP 202：

~~~json
{"request_id":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","state":"accepted","boot_id":"00000000-0000-4000-8000-000000000001"}
~~~

失败示例 HTTP 409（不会停止正在运行的业务）：

~~~json
{"error":{"code":"DEVICE_BUSY"}}
~~~

## 准入、持久化与重试

- 普通空闲可以重启，无需先安装更新。OTA 只有 reboot_required 可以关联当前安装后重启；上传、校验、安装、待核查或试启动确认中拒绝新的重启。
- VIO 运行/控制、TF 录制/收尾/预检、按键动作、MAVLink 管理操作、深度占用及灰度/IMU/彩图/深度采集和下载租约会阻止重启，不自动停止业务。普通预览、空闲里程计订阅可以存在，受理后关闭连接，重启后由客户端重新订阅。
- 与配置变更、实体按键和更新准入共用锁；已受理重启时不能再开始业务或保存配置。查询接口仍可使用。
- 网关沿用已有维护准入：重启受理后新开数据流/下载返回409 UPDATE_BUSY；业务配置写入返回409 REBOOT_BUSY。已有普通预览和空闲里程计连接由维护观察器关闭。
- 最近请求和幂等回执存于持久 user 分区的 /home/.robobaton-update/reboot，目录 0700，文件 0600；这是业务状态，不是运行日志。临时维护标记是 /run/robobaton-neo-firmware.pending.reboot，与 OTA 标记独立。
- 相同 key 永远返回原始 202 回执，**即使原请求已失败或已经跨 boot，也不再次执行**。与安装 key 使用独立命名空间。最多保留 128 个持久 key，满后拒绝新的请求，不自动淘汰；接口只提供最近请求查询，不提供历史清除入口。
- 超时/断连后先 GET 核对；需要找回原回执时用原 key 再次 POST，不换 key 盲重试。若最近记录已被其他客户端的新请求覆盖，不能拿它判断旧请求结果。确定失败且用户仍希望重启，才创建新 key。
- 设备服务在同一 boot 内重启时，将未完成请求标为 failed / REBOOT_INTERRUPTED，绝不自动重新执行；跨 boot 则核对结果。最近请求记录恢复或新请求持久化失败时保守拒绝新请求，available=false，修复存储后再处理；单个旧 key 回执损坏时，该 key 返回503，不执行重启。

## 与 OTA 的关系

更新流程为：上传包 → POST /api/update（install）→ GET /api/update 等待 reboot_required → POST /api/system/reboot {} → 分别查询系统启动和更新结果。

系统重启模块在准入锁内关联当时的安装操作，并将更新状态改为 rebooting。执行失败则更新回到 reboot_required，保留 UPDATE_REBOOT_FAILED 和维护状态；不会重复写备用槽。更新状态查询不会把仍在执行的重启改回等待状态。

板卡重启成功但新槽回退时，系统请求可以是 succeeded，更新操作仍是 failed / UPDATE_BOOT_FAILED。**OTA 成功必须以 GET /api/update 的 succeeded 及 A/B 健康确认结果为准。**

POST /api/update 只保留 install；旧 reboot 动作及其 operation_id 字段已删除，不提供兼容别名。网页“重启并生效”改用系统接口，仍在更新页显示安装结果；本轮没有新增通用重启按钮。

## 错误

| HTTP / code | 含义及处理 |
| --- | --- |
| 400 INVALID_REQUEST | 正文、请求头、幂等键不合法 |
| 404 NOT_FOUND | 路径/方法或查询参数不支持 |
| 400 INCOMPLETE_BODY | 请求头未接收完整 |
| 408 REQUEST_TIMEOUT | 正文接收超时 |
| 413 BODY_TOO_LARGE | 正文超过 128 字节 |
| 409 DEVICE_BUSY | 业务运行，先由调用者正常结束业务 |
| 409 CAPTURE_ACTIVE | 采集/下载或准入租约冲突，结束连接后重试 |
| 409 UPDATE_BUSY | OTA 阶段不允许重启，先查更新状态 |
| 409 REBOOT_BUSY | 重启正在执行；配置写入也会返回此码 |
| 503 REBOOT_STORAGE_FAILED | 状态或回执读取/写入不可靠，不可认定请求未受理 |
| 503 REBOOT_HISTORY_FULL | 128 个请求回执已满，需要维护 |
| 503 REBOOT_FAILED | 创建执行线程失败；执行阶段失败也可通过 GET 的 reboot.error 返回 |
| 503 UPDATE_STORAGE_FAILED | 关联更新状态保存失败，先查两项状态，不盲重试 |
| 503 DEVICE_UNAVAILABLE / DEVICE_REQUEST_UNCONFIRMED / DEVICE_PROTOCOL_MISMATCH | 设备服务不可用、IPC 响应未确认或协议不匹配，先查询 |

GET 的 reboot.error 还可能为 REBOOT_INTERRUPTED 或 REBOOT_STORAGE_FAILED。状态查询可正常返回 200 并携带失败结果；不把异步失败伪装成请求传输错误。

系统重启与网络切换互斥；网络切换正在执行时，新重启请求返回 409 DEVICE_BUSY，不中止网络事务。

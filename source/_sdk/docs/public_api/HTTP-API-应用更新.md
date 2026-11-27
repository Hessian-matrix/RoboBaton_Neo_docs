# 应用更新

使用适用于当前设备的 .viofw 更新包，依次完成上传、校验、安装和重启。只使用产品提供的更新包，不自行编辑或重新打包。网页通过固定 firmware/latest.json 检查新版本，经用户确认后下载并上传更新包。安装和重启需用户操作。

## 更新前

停止 VIO、录制、预检和正在进行的设备配置操作。确认设备供电稳定、存储空间充足，并核对更新说明中的设备与版本要求。安装及重启期间连接会暂时中断；设备配置和用户数据保留。不同系统布局之间的迁移需按发布说明执行，不能直接使用普通更新流程。

## GET /api/update

返回 HTTP 200。主要字段如下；完整客户端结构见公开 OpenAPI。

| 字段 | 含义 |
| --- | --- |
| running、gateway_running | 当前设备服务、网页服务的 version 和 build_id；未知为 null |
| package | 校验通过的候选更新包；没有时为 null |
| operation | 最近操作的 operation_id、state、package_id 和 error；没有时为 null |
| maintenance | 是否处于维护状态 |
| upload | received_bytes 和 total_bytes；未上传时为 null |
| limits | 上传大小上限、可用空间及预留空间 |
| available | 当前是否可使用更新功能 |

metadata 是只读信息，客户端可显示 product、hardware、version、build_id、notes；忽略其他内部字段，不用返回信息构造更新包。

operation.state 依次为 accepted、installing、reboot_required、rebooting、succeeded。失败为 failed；结果需要核查时为 recovery_required。error 为 null 或仅包含 code 的对象。安装信息与当前运行版本分开，安装完成不代表新版本已经运行。

状态响应字段节选：

    {"operation":{"operation_id":"0123456789abcdef0123456789abcdef","state":"installing","package_id":"设备返回的更新包标识","error":null},"maintenance":true}

## POST /api/update/package

请求体为原始 .viofw 文件，Content-Type 为 application/octet-stream，必须提供唯一 Content-Length。不接收 multipart、chunked 或 Expect，不提供断点续传。

上传上限为512MiB，实际还受可用空间和包兼容性限制。至少预留两倍包大小加4MiB；安装还会检查可用空间。上传15秒无进展或总计600秒超时即结束，后续校验最长180秒。

成功返回 HTTP 200：

    {"package_id":"64位小写十六进制标识","metadata":{"product":"RoboBaton-Neo","hardware":"robobaton-neo-board1","version":"示例版本","build_id":"示例构建","notes":"更新说明"}}

metadata 仅展示客户端使用的字段。安装请求须原样使用实际返回的 package_id。上传100%后仍需等待校验完成；HTTP 200才表示候选包可安装。仅保留一个候选和一个进行中的上传。失败不会替换原候选，不完整文件不能安装。候选信息持久保存，服务重启后会重新检查。

## POST /api/update

Content-Type 为 application/json，Idempotency-Key 为1～96个字母、数字或下划线、点、冒号、短横线。

    {"action":"install","package_id":"上传接口返回的标识"}

成功受理返回 HTTP 202：

    {"operation_id":"0123456789abcdef0123456789abcdef","state":"accepted"}

202只表示受理，应持续查询 GET /api/update，等待 reboot_required 后调用[系统重启接口](HTTP-API-系统.md)：POST /api/system/reboot，请求体为空对象，使用独立 Idempotency-Key。

相同 key、动作和目标返回原操作，不重复安装；同 key 不同内容返回409。最多保留128个持久 key，不自动淘汰。请求超时或结果不明确时先查询状态，不更换 key 盲目重试。旧 reboot 动作及 operation_id 请求字段返回400 INVALID_REQUEST。

## 错误与恢复

失败示例：HTTP 422：

    {"error":{"code":"PACKAGE_INVALID"}}

请求错误返回400，超时408，设备忙或键冲突409，包过大413，校验失败422，状态保存失败500，不可用或结果未确认503，空间不足507。

available=false 时上传和安装返回503 UPDATE_UNAVAILABLE。维护期间不可启动新任务或修改配置；正在录制、采集、预检、运行 VIO、修改网络或执行飞控操作时，可能返回409 UPDATE_BUSY。更新与网络修改互斥。

上传前释放不需要的采集和下载连接。安装过程可继续查询状态，但不要断电、重复提交安装或强行解除维护。安装后不会自动重启。

重启后重新连接设备并检查运行版本和 operation.state。succeeded 表示新版本启动确认完成；failed 或 recovery_required 时按错误码和发布说明处理。不要仅以网页重新连接或上传完成判断升级成功。版本更新不等于定位精度、外设和长期运行性能已完成验收。

V2.0.0：GET /api/update 不再返回 installed。running 与 gateway_running 来自实际运行程序；安装但未重启仍显示旧版。package 是候选包，不代表运行版本。

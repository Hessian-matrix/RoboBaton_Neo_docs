# 错误码

2026-11-05 起，失败响应为 {"error":{"code":"COMMAND_BUSY"}}，不再包含 message。HTTP 状态码仍有意义；先检查 HTTP 状态，再读 code。客户端对未知码保留原码，不假定只有本文所列错误。

2026-11-06安装补偿核对：GET/POST /api/mount/config的逐状态错误和重试规则见[接口说明](HTTP-API-安装补偿.md)。POST允许VIO运行及启停期间保存，不再因VIO状态或生命周期锁返回VIO_BUSY；应用更新期间仍返回409 UPDATE_BUSY。GET携带禁止的传输头返回INVALID_REQUEST，POST配置请求非法返回INVALID_CONFIG。CONFIG_SAVE_FAILED或DEVICE_REQUEST_UNCONFIRMED不能证明文件未写入，应先GET确认。

这是实验的明确契约收紧，需同步更新网页和主控。成功响应、里程计、RBH1 布局不变。内部 v2 保留原结构；网页本地计算异常和设备日志仍可有可读文字。录制 end_reason/reason、MAVLink 异步操作 error 字符串仍为原因码，不增加 message。已经发送流响应头后不能改 HTTP 状态，断流仍须由消费者检测，不承诺每次断流都有错误消息。

| code | 含义与处理 |
|---|---|
| DEVICE_BUSY | 系统重启被运行中的业务拒绝；不自动停止任务 |
| REBOOT_BUSY | 系统重启正在执行或状态存储异常；先查询 /api/system/status |
| REBOOT_FAILED | 重启执行失败；核对状态后可使用新 key 发起新请求 |
| REBOOT_INTERRUPTED | 同一 boot 内服务重新启动，原重启请求不自动重放 |
| REBOOT_STORAGE_FAILED | 重启状态或回执存储不可靠，不能盲目重发 |
| REBOOT_HISTORY_FULL | 128 个持久重启 key 已满，需维护 |
| UPDATE_REBOOT_FAILED | 关联的系统重启失败，更新仍等待重启 |
| BODY_TOO_LARGE | 请求内容过大 |
| BUTTON_UNAVAILABLE | 按键服务不可用 |
| CALIBRATION_BUSY | 标定参数正在使用，请结束任务后重试 |
| CALIBRATION_LOAD_FAILED | 标定文件损坏、不可读或不是可接受的普通文件；仅文件不存在时使用默认参数 |
| CALIBRATION_REQUIRED | VIO 的独立 warning：当前实例使用默认参数，需要设备标定；不是失败响应 |
| CALIBRATION_SAVE_FAILED | 标定参数保存未确认，请重新读取 |
| CATALOG_INVALID | 录制目录数据无效 |
| CATALOG_UNAVAILABLE | 录制目录暂不可用 |
| CHECK_ACTIVE | 录制预检正在运行，请结束后重试 |
| CHECK_CACHE_FULL | 预检缓存已满 |
| CHECK_UNAVAILABLE | 录制预检服务不可用 |
| COLOR_NOT_READY | 彩色图像或关键帧尚未就绪，请重新连接 |
| COLOR_UNAVAILABLE | 彩色图像服务暂不可用 |
| COMMAND_BUSY | 已有 VIO 命令正在执行，请稍后重试 |
| COMMAND_UNAVAILABLE | VIO 命令服务暂不可用 |
| CONFIG_APPLY_FAILED | 配置应用未确认，请重新读取 |
| CONFIG_CHANGED | 配置已变化，请重新读取 |
| CONFIG_CONFLICT | 配置与当前运行条件冲突，请重新读取 |
| CONFIG_INVALID | 设备配置数据无效 |
| CONFIG_LOAD_FAILED | 设备配置读取失败 |
| CONFIG_SAVE_FAILED | 配置保存未确认，请重新读取 |
| CONTEXT_UNAVAILABLE | 数据源信息暂不可用 |
| DATASET_BUSY | 该录制仍在使用，请稍后重试 |
| DATASET_INVALID | 录制文件结构无效 |
| DATASET_NOT_READY | 录制尚未完成收尾 |
| DELETE_FAILED | 删除未确认，请刷新列表检查 |
| GRAY_NOT_READY | 灰度图像尚未就绪 |
| GRAY_UNAVAILABLE | 灰度图像服务暂不可用 |
| IMU_UNAVAILABLE | IMU 服务暂不可用 |
| INCOMPLETE_BODY | 请求未完整接收，请重试 |
| INVALID_ACTION | 操作类型无效 |
| INVALID_CALIBRATION | 标定参数格式或数值无效 |
| INVALID_CHANNEL | 请选择支持的数据通道 |
| INVALID_CONFIG | 配置字段或参数范围无效 |
| INVALID_REQUEST | 请求格式无效 |
| KEY_CONFLICT | 同一请求标识不能用于不同操作 |
| NOT_FOUND | 设备未开放此接口或资源不存在 |
| OUT_OF_MEMORY | 设备内存不足 |
| PREVIEW_UNAVAILABLE | 预览服务暂不可用 |
| RANGE_UNSUPPORTED | 此下载不支持断点续传 |
| RECORDER_BUSY | 录制程序正忙 |
| RECORDING_ACTIVE | 已有录制任务，请结束后重试 |
| RECORDING_BUSY | 录制正在启动或保存，请稍后重试 |
| RECORDING_CONFLICT | 录制任务已变化，请重新查询 |
| RECORDING_REQUIRES_VIO | 正在录制里程计，请先停止并保存录制 |
| RECORDING_UNAVAILABLE | 录制服务暂不可用 |
| REQUEST_TIMEOUT | 设备接收请求超时，请重试 |
| RESOURCE_UNAVAILABLE | 设备资源暂不可用 |
| RESULT_INVALID | 录制结果数据无效 |
| SNAPSHOT_FAILED | 录制配置快照保存失败 |
| STORAGE_FULL | TF 卡空间不足 |
| STORAGE_NOT_READY | TF 卡尚未就绪 |
| STORAGE_READ_ONLY | TF 卡为只读 |
| STORAGE_UNAVAILABLE | TF 卡不可用，请检查卡状态 |
| STREAM_LIMIT | 数据流连接已达上限，请关闭不需要的连接 |
| STREAM_RANDOM_ACCESS_TIMEOUT | 等待视频参数或关键帧超时，请重新连接 |
| UPDATE_UNAVAILABLE | 系统 A/B 标识或更新器缺失；更新返回503，不使用旧目录安装方式 |
| UPDATE_BOOT_FAILED | 新系统试启动未通过，已回到原版本；检查包和设备后再发起更新 |
| VIO_BUSY | 旧安装保存保护码；当前安装接口已不返回此码，旧板端出现时需核对配套版本 |
| VIO_COMMAND_FAILED | VIO 命令执行失败，请检查设备后重试 |
| VIO_EXITED | VIO 进程意外退出 |
| VIO_NOT_RUNNING | VIO 尚未运行 |
| VIO_STATE_UNAVAILABLE | 无法读取 VIO 状态，请检查连接后重试 |

MAVLink 已有小写错误码保持不改大小写；invalid_request、request_timeout 与上述对应大写码含义一致，其余见 [MAVLink 接口](HTTP-API-MAVLink.md)。DEVICE_CHANGED 为网页本地产生的取消原因，不是板端错误码。

CALIBRATION_REQUIRED 是 GET /api/vio 的 warning.code，表示该运行实例使用默认参数、需要设备标定；不是 error，也不改变成功 HTTP 状态。

网络配置新增：409 NETWORK_CHANGING（切换中）、503 NETWORK_UNAVAILABLE（接口或配套系统不可用）。400 INVALID_CONFIG、503 CONFIG_SAVE_FAILED、409 UPDATE_BUSY / REBOOT_BUSY 复用；详见[网络配置](HTTP-API-网络配置.md)。

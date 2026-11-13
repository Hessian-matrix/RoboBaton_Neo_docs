# USB 网络配置

GET /api/network/config 返回 200、{"subnet":11}，表示内核实际 usb0 地址，不是保存文件。地址固定为 192.168.subnet.1/24；subnet 为 11～255 整数，默认 11。第三段 255 合法，范围不保证避开电脑的其他网段。

POST 同一路径，Content-Type: application/json，Content-Length 必填，正文示例 {"subnet":47}，最多 64 字节，只允许 subnet 字段。字符串、浮点表示、未知/重复字段、chunked 均拒绝。无需 Idempotency-Key。

相同生效网段返回 200 和当前配置，无写盘或断网；新网段返回 202、{"accepted":true}，仅表示受理。网关发完响应头和正文后才经 IPC 允许执行；网关断开或 5 秒未确认则取消。TCP 写成功不等于浏览器收到；丢响应不自动重发，应先在新地址 GET，若不能连接再核对旧地址。

## 生效、保存与故障

先预写并 fsync 临时文件，再返回受理。收到网关确认后停止 DHCP，usb0 down 两秒，替换 IPv4，清旧租约，启动新网段 DHCP，usb0 up。本地核对成功后原子 rename 并 fsync 配置目录。GET 在整个切换和保存期间返回 409，不暴露中间状态。

保存位置 /home/VIO/parameters/usb-network.conf：一行十进制整数，通过 SDK 的 parameters bind mount 落在 user 分区。配置不作为 shell 脚本执行。掉电可能留下旧值或新值，不承诺掉电时收到响应；本地执行/保存失败尝试恢复旧地址和配置。202 后不能补发 HTTP 失败，需从旧/新地址读回。若回退本身因存储或硬件异常失败，不宣称恢复成功；修复存储后重新启动并读回。

网络辅助程序与 DHCP 归外部 SDK。S20-usbncm 在存储挂载前提供默认恢复地址 192.168.11.1；S21-usb-dhcp 从当前 usb0 地址生成 DHCP 配置；S31-usb-network 在 S30 挂载用户分区后、应用启动前恢复保存网段。缺失配置默认 11；非法配置保留早期默认 11。动态 DHCP 配置 /run/udhcpd-usb0.conf，地址池 .100～.150，租期 43200 秒，不下发网关/DNS。

不解绑 UDC、不重建 gadget、不重启系统，不停止 VIO/TF 录制。网络变化会中断预览、浏览器采集等外部连接；完整采集应由用户先结束。电脑需要自动获取 IP；固定 IP 不跟随改变。主机 DHCP 换租是否成功必须另行验证，不能由板端 IP 正确推断。

## 并发、错误与生命周期

同一时刻一个网络修改，不排队。与 OTA 上传、安装及系统重启双向互斥。业务线程不持有网络执行锁。任务使用此次 IPC 线程和短暂系统 helper，无新增常驻线程。进程退出不重放；强杀可能遗留 /run 锁，重启后按持久配置初始化。

错误示例 {"error":{"code":"NETWORK_CHANGING"}}；只有 code。

| 条件 | HTTP / code |
| --- | --- |
| 请求或字段非法 | 400 / INVALID_CONFIG |
| 网络正在切换/保存 | 409 / NETWORK_CHANGING |
| OTA 进行中或等待激活 | 409 / UPDATE_BUSY |
| 系统重启占用 | 409 / REBOOT_BUSY |
| usb0 无可识别地址、系统 helper 不配套 | 503 / NETWORK_UNAVAILABLE |
| 配置预写失败 | 503 / CONFIG_SAVE_FAILED |
| 设备服务不可用或调用未确认 | 503 / DEVICE_UNAVAILABLE、DEVICE_REQUEST_UNCONFIRMED |

网页“设备设置”提供网络和按键标签；修改前展示旧/新地址，受理或丢响应后保留新地址入口，不自动重发、不跨域探测。只有访问主机与 GET 实际网段都匹配目标才显示成功。

必须使用包含相同 SDK helper、设备服务、网关与网页的系统 A/B OTA 包。应用仓库不携带旧系统脚本，也不通过旧在线部署脚本修改 /etc。开发机故障回归见 tests/platform/test_network_config.py；实机和浏览器验收范围见本次合入验证报告，不沿用源分支的验收结论。

# STM32 串口接入示例

neo_mavlink.c/h 是独立 C99、无堆内存、无 HAL 依赖的只读解码器。examples/neo_uart.c/h 是 STM32Cube HAL 中断接收适配示例，不是特定芯片的完整可烧录工程。需要结合你的 STM32 型号、时钟、引脚和 CubeMX 工程配置。

## 接线和设备准备

- Neo U13-3 (TX) → STM32 UART_RX；U13-5 (GND) → STM32 GND。
- 只读接收无需 STM32 TX；双向时 STM32 TX → U13-4 (RX)，本例不发送任何命令。
- 信号使用 3.3 V TTL，不能接 RS-232 电平；U13-1/2 不接。Neo 按硬件要求独立供电，U13-6 是供电端，不接 STM32 GPIO 或模块 3.3 V。
- 在设备网页核对 UART2 波特率，默认 921600、8N1、无流控。设备在搜索飞控时暂停里程计，先退出搜索并启动 VIO。默认发送 system_id=1、component_id=197；修改过时同步 NEO_SYSTEM_ID/NEO_COMPONENT_ID。

## 加入 STM32Cube 工程

1. 将 neo_mavlink.c/h 和 examples/neo_uart.c/h 添加到工程及头文件搜索路径。
2. CubeMX 配置目标 UART、NVIC 中断、对应 AF 引脚，波特率与设备一致，8 位数据、1 停止位、无校验/流控；main.h 应能提供 HAL UART 类型和 CMSIS 内存屏障。
3. UART 初始化后调用 neo_uart_start(&huartX)，检查返回 HAL_OK。主循环频繁调用 neo_uart_poll()，再用 neo_uart_latest(&sample) 读取当前有效结果。
4. 若工程已有 HAL_UART_RxCpltCallback / HAL_UART_ErrorCallback，将本例分支合并到现有回调，不能重复定义。回调仅入队，不运算/打印/阻塞。1 KiB 环形缓冲在满速连续输入下约 11 ms 填满；实际推荐 DMA+IDLE 接收，继续调用同一个 neo_mavlink_feed。

~~~c
neo_odometry_t sample;
if (neo_uart_start(&huart2) != HAL_OK) Error_Handler();
while (1) {
    neo_uart_poll();
    if (neo_uart_latest(&sample)) {
        consume_odometry(&sample);
    }
}
~~~

## 协议边界

仅接受无签名 MAVLink 2 ODOMETRY（ID 331，CRC extra 91，payload 230～233 字节），其余消息含 HEARTBEAT 不产生里程计；不把心跳当定位有效。校验头/CRC、有限浮点数、单位四元数及质量范围；扩展字段缺省 0（quality=0 是未知而非失败）。签名包与未知 flags 拒绝，不宣称支持认证；CRC 不是安全认证。只输出需要的位姿/速度/身份/帧/质量/reset，不对外提供 covariance。

四元数是 w,x,y,z（与 HTTP 具名顺序不同）；位置 m，线速度 m/s，角速度 rad/s，时间 us。frame_id / child_frame_id 必须由用户按设备安装配置解释；不预设 NED/ENU/FLU。reset_counter 变化或 time_usec 倒退需上层重置融合；本例不控制飞行、不提供闭环控制安全保证。

CRC 错误或噪声不会交付位姿；单字节丢失可能同时丢弃后续帧，后续重新捕获帧头。20 ms 无字节重置半包，环形缓冲溢出/硬件错误清空并重新接收；超 250 ms 或 quality=-1 不返回有效数据。最近结果可能重复返回，应用须比较 time_usec；消费端不能无限沿用旧位姿。HAL 示例只在主循环使用，非多线程共享接口。

主机 C 测试覆盖正常/截断/错 CRC/噪声/扩展字段/签名/非有限值；仓库内构建还将现有 VIO 生产编码器接到 HAL 桩、环形缓冲和 SDK 解码器，检查身份筛选、超时及溢出恢复。未连接真实 STM32，不代表接线、IRQ 时序或串口长期可靠性已验收。

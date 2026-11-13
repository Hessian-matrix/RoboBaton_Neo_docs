STM32 串口 SDK
==============

.. container:: doc-lead

   用独立 C99 解码器接收 Neo MAVLink 2 位姿，再按自己的 STM32 工程接入 UART。

获取与接线
----------

在 :doc:`sdk` 下载并解压。SDK/stm32/neo_mavlink.c/h 无 HAL 依赖、无堆分配；
SDK/stm32/examples/neo_uart.c/h 是 Cube HAL 适配，不是特定芯片的完整可烧录工程。

.. list-table:: 只读 UART 接线
   :header-rows: 1
   :widths: 40 60

   * - Neo 扩展端子
     - STM32 / 电源连接
   * - U13-3 · UART_TX
     - STM32 UART_RX，3.3 V TTL
   * - U13-4 · UART_RX
     - 只读示例不需要连接；双向时接 STM32 UART_TX
   * - U13-5 · GND
     - STM32 GND 与独立电源负极共地
   * - U13-6 · 供电端
     - 按对应硬件版本供电，不接 GPIO 或 3.3 V 信号端
   * - U13-1 / U13-2
     - 本例不接

完整引脚图与电源注意事项见 :doc:`connect-serial`；不得接 RS-232 或 5 V 信号。
在设备网页核对波特率（默认 921600）、8N1、无流控，退出飞控搜索并启动 VIO。
默认发送 system_id=1、component_id=197；修改过身份时同步 NEO_SYSTEM_ID / NEO_COMPONENT_ID。

加入 CubeMX / HAL 工程
------------------------------

1. 添加 neo_mavlink.c/h 和 examples/neo_uart.c/h 到源文件及头文件搜索路径。
2. 配置 UART AF 引脚、时钟、NVIC 与匹配波特率；main.h 提供 HAL UART 类型和 CMSIS 屏障。
3. UART 初始化后调用 neo_uart_start(&huartX)，检查 HAL_OK。
4. 主循环频繁调用 neo_uart_poll()；neo_uart_latest(&sample) 返回 1 才使用当前结果。
5. 已有 HAL_UART_RxCpltCallback / HAL_UART_ErrorCallback 时合并分支，不能重复定义回调。

.. code-block:: c

   neo_odometry_t sample;
   if (neo_uart_start(&huart2) != HAL_OK) Error_Handler();
   while (1) {
       neo_uart_poll();
       if (neo_uart_latest(&sample)) {
           consume_odometry(&sample);
       }
   }

huart2 和 consume_odometry 是接收端工程示意，需替换成自己的 UART 句柄和业务函数，
不是 Neo 板端串口配置接口。中断只入队；不要在回调中打印或阻塞。
1 KiB 环形缓冲在持续满速输入下约 11 ms 填满，正式工程推荐 DMA+IDLE，继续复用 neo_mavlink_feed。

解码 API
--------

.. literalinclude:: _sdk/SDK/stm32/neo_mavlink.h
   :language: c
   :caption: 直接来自 SDK/stm32/neo_mavlink.h

独立使用时先 neo_mavlink_reset(&parser)，对每字节调用 neo_mavlink_feed(&parser, byte, &sample)。
返回 1 代表本条有效 ODOMETRY；返回 0 不交付新位姿，不把心跳当定位结果。
HAL 示例默认筛选来源身份，独立解析器的调用者需自己筛选。

字段与安全边界
--------------

* 只接受无签名 MAVLink 2 ODOMETRY，ID 331、CRC extra 91、payload 230–233 字节；不支持签名认证，CRC 也不是安全认证。
* 位置 m、速度 m/s、角速度 rad/s、时间 us，四元数为 w/x/y/z；frame_id / child_frame_id 解释安装补偿后的实际帧，不重复补偿。
* 校验有限数、四元数和质量；quality=0 表示未知，quality=-1 不作为 HAL 有效结果。
* 半包 20 ms 无字节清除；溢出/硬件错误清空并重启接收；250 ms 没有新里程计则失效。
* latest 可能返回同一条结果，应用用 time_usec 去重；时间倒退或 reset_counter 变化需重置上层融合。
* 不对外提供 covariance；不发送飞控配置、起飞、解锁或控制命令，不提供闭环安全保证。

主机已联测现有生产 MAVLink 编码器、HAL 桩、缓冲和 SDK 解码器；真实 STM32 型号、
供电、引脚、时钟与中断仍需实测，不把主机回归当作烧录验收。

.. container:: doc-next

   电脑串口接收见 :doc:`serial-pose`；飞控接入见 :doc:`mounting-flight-controller`。

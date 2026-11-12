通过串口获取 VIO 位姿
=====================

VIO 初始化完成后，通过 3.3 V LVTTL 串口接收 MAVLink 2 ODOMETRY（消息 ID 331）。
本步骤接收位姿；图像请通过 :doc:`api-examples` 获取。

接线与配置
----------

接入教程提供逐针连线图，点击针号可高亮线路。图按端子编号展开，不表示插头的观察方向；
USB 转 TTL 模块的端子排列因型号不同而异，按模块丝印核对。
当前产品接口说明中，1 为 EXPOSURE_OUT、2 为 TRIGGER_IN（本次不接），
3 为 UART_TX、4 为 UART_RX、5 为 GND、6 为 VIN。
GND 同时连接模块 GND 与独立电源负极；VIN 连接电源正极。

1. 按对应硬件版本的接口图核对 TX、RX、GND，不根据插头外观推测针号。
2. 使用 3.3 V TTL 接收设备或 USB 转串口模块：Neo TX 接接收端 RX，GND 共地。
   需要双向通信时，接收端 TX 接 Neo RX。不能直接接 RS-232 或 5 V 电平。
3. 接电脑时，使用 USB 转 TTL 模块连接电脑 USB；模块信号电平设为 3.3 V，
   不使用 RS-232 模块。模块 VCC 不接 Neo，本示意采用独立稳压电源：
   电源正极接 Neo VIN，负极接 Neo GND，并与模块 GND 共地。
   当前接口标注 VIN 为 3.3–5 V，接线前仍须核对对应硬件版本。
   信号电平 3.3 V 与 VIN 供电范围是两个不同参数。
   仅单向接收位姿时，除供电外接 TX→RX 和 GND；需要双向通信时才增加 Neo RX←模块 TX。
4. 通过 GET /api/serial/status 查询当前波特率，接收端设置相同速率。
   缺省 921600 bit/s，8N1、无流控；已修改设备以当前配置为准。
5. 在设备网页启动 VIO，选择动态或静止初始化，完成后接收 ODOMETRY。

串口输出不要求飞控在线，无需先等待飞控心跳。没有有效 VIO 新数据时不重复最后位姿；
搜索飞控期间暂停里程计输出。心跳在线不能代表位姿有效。

网页直接接收
------------

在 `接入你的程序 <../integration.html>`_ 选择串口、JavaScript 网页直接运行，
填入设备波特率后点击“连接并运行”，从浏览器弹窗选择 USB 转 TTL 模块。
电脑 Chrome / Edge 支持此流程，页面须通过 HTTPS 或 localhost 打开。
收到有效 ODOMETRY 后显示真实坐标和原始字段；无数据时不填入示例结果。
也可选择“Python · 网页直接运行”，加载浏览器 Python 环境后连接，查看 Python 实际输出。
无需在电脑安装 Python / Node.js；仍需正确供电、接线和启动 VIO。
详细运行限制见 :doc:`api-examples`。

Python 接收示例
---------------

安装依赖：

.. code-block:: bash

   python -m pip install pymavlink pyserial

将以下代码保存为 serial_pose.py：

.. code-block:: python

   import os
   os.environ['MAVLINK20'] = '1'
   import argparse
   from pymavlink import mavutil

   parser = argparse.ArgumentParser()
   parser.add_argument('port')
   parser.add_argument('--baud', type=int, default=921600)
   args = parser.parse_args()
   connection = mavutil.mavlink_connection(args.port, baud=args.baud, dialect='common')
   try:
       while True:
           message = connection.recv_match(type='ODOMETRY', blocking=True, timeout=5)
           if message is None:
               print('No pose: check initialization, wiring and baudrate.', flush=True)
               continue
           print({'system': message.get_srcSystem(), 'component': message.get_srcComponent(),
                  'time_usec': message.time_usec, 'frame_id': message.frame_id,
                  'child_frame_id': message.child_frame_id,
                  'position_m': [message.x, message.y, message.z],
                  'quaternion_wxyz': list(message.q)}, flush=True)
   except KeyboardInterrupt:
       pass
   finally:
       connection.close()

.. code-block:: bash

   python serial_pose.py COM5 --baud 921600
   python serial_pose.py /dev/ttyUSB0 --baud 921600

选择对应系统的命令并替换实际端口，Linux 需有串口访问权限。脚本仅接收数据，不发送配置或控制命令。

字段与参考点
------------

x/y/z 单位为米，q 顺序为 w/x/y/z；与 HTTP 具名四元数字段排列不同。
读取 frame_id、child_frame_id 判断实际坐标定义，不将局部位置当成 GPS 经纬度。
串口输出已应用安装补偿，接收端不要重复补偿。输出速率受有效定位、配置和串口带宽限制，
不保证所有条件下达到 30 Hz。无位姿时先检查初始化、接线和双方波特率。

接入飞控时继续阅读 :doc:`mounting-flight-controller`。本页示例检查不代表实机串口验收。

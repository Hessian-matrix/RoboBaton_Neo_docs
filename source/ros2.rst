接入 ROS 2
==========

.. container:: doc-lead

   SDK 已提供 ROS 2 ament_python 示例包，复用 Python SDK 接收 HTTP 里程计和灰度 JPEG 图像。

准备与构建
----------

先在 :doc:`sdk` 下载并解压到 /absolute/path/neo-sdk，连接 Neo，启动 VIO 并完成初始化。
在已有 ROS 2 和 colcon 的电脑上加载对应发行版环境，使用原 rclpy 所在 Python，
不要换到没有 rclpy 的普通虚拟环境：

.. code-block:: bash

   python3 -m pip install -e /absolute/path/neo-sdk/SDK/python
   mkdir -p /your/ros2_ws/src
   ln -s /absolute/path/neo-sdk/SDK/ros/ros2/robobaton_neo /your/ros2_ws/src/robobaton_neo
   cd /your/ros2_ws
   colcon build --packages-select robobaton_neo
   source install/setup.bash
   ros2 run robobaton_neo neo_odometry --ros-args -p origin:=http://192.168.11.1

另开终端，加载相同环境检查：

.. code-block:: bash

   source /your/ros2_ws/install/setup.bash
   ros2 topic echo /neo/odometry
   ros2 topic echo /neo/source_header
   ros2 topic hz /neo/odometry
   ros2 topic hz /neo/image/compressed
   ros2 topic echo /neo/image/source_header

跨电脑时确认 ROS_DOMAIN_ID 和 DDS 发现/网络策略。路径是示意，替换自己的解压位置和工作区。
本次没有给出已验收的 ROS 2 发行版矩阵，不能把示例源码当成某发行版的完整兼容承诺。

完整节点源码
------------

.. literalinclude:: _sdk/SDK/ros/ros2/robobaton_neo/robobaton_neo/node.py
   :language: python
   :caption: 直接来自 SDK ROS 2 节点

实际发布的话题
--------------

.. list-table::
   :header-rows: 1
   :widths: 30 30 40

   * - 话题
     - 消息
     - 内容
   * - /neo/odometry
     - nav_msgs/Odometry
     - 有效位姿和 IMU 系速度
   * - /neo/source_header
     - std_msgs/String
     - 原始设备 seq/stamp JSON

图像接收默认开启，与位姿使用独立连接，直接转发 gray_jpeg 的 JPEG 字节，
无需 OpenCV 或 cv_bridge，依赖 sensor_msgs：

* /neo/image/compressed：sensor_msgs/CompressedImage，544×640 mono8 JPEG。
* /neo/image/source_header：std_msgs/String，原设备图像 seq/stamp JSON。
* format 为 mono8; jpeg compressed mono8，不进行解码重编码。
* 不发布原始 Image、CameraInfo、IMU 话题或 TF；不能把计划写成已提供功能。

使用支持 compressed transport 的图像查看器订阅 /neo/image；若直接订阅
/neo/image/compressed，必须使用 CompressedImage 类型，不是普通 Image。
源帧率模式不承诺固定发布频率，慢消费者只保留最新一帧。

默认 image_frame=neo_camera_optical，光学系 X向右/Y向下/Z向前；
改名不会完成相机/IMU 外参变换。图像 header.stamp 为主机发布时间，
原始设备时间保留在 /neo/image/source_header。图像、源 header 与里程计不是原子配对，
未经独立时钟同步与标定不得当作精确融合输入。

时间、坐标与协方差
------------------

默认 neo_world → neo_imu；世界 Z 向上，初始航向不是地理北，速度在 IMU 系。
四元数为 x/y/z/w。修改 frame 名字不会执行安装补偿，不能把 neo_imu 改名 base_link 就当成机器人中心。

header.stamp 使用主机发布时的 ROS 时钟，不把设备开机单调时间冒充 UNIX 时间。
原设备 header 保留在 /neo/source_header；两个 topic 不是原子配对。
精确多传感器融合前需要实现独立时钟同步。实物节点不应使用未运行的模拟 /clock。

设备不提供 covariance。assumed_pose_variance 和 assumed_twist_variance 默认均为 1000000，
填 6×6 对角线，是示例假设而非设备估计质量。它们分别同时用于位置/角度、线/角速度，
量纲分别为 m²/rad²、(m/s)²/(rad/s)²；正式融合前按机器人验证并扩展适配器。

null pose/twist/stamp 跳过，不补零。后台接收队列仅保留最新一条，慢消费者可能丢帧。
断流、序号复位或源时间倒退报错退出，不自动续接；用户显式启动新会话。

参数与验证
----------

两版共用 origin、image_frame、world_frame、imu_frame、assumed_pose_variance、assumed_twist_variance。
系统禁止全局 pip 安装时，可使用同一 ROS 终端的 PYTHONPATH，不强制破坏系统 Python：

.. code-block:: bash

   export PYTHONPATH=/absolute/path/neo-sdk/SDK/python:$PYTHONPATH

主机测试覆盖消息映射、空值、队列、源时间和断流处理，**尚未完成真实 ROS 构建/运行、
DDS 或机器人融合验收**。安装后须核对话题、频率和方向，停止 VIO / 断开 USB 后不能继续发布旧位姿。

.. container:: doc-next

   统一坐标规则见 :doc:`sdk`；字段来源见 :doc:`api-reference`。

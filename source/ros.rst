接入 ROS
========================

.. container:: doc-lead

   在运行 ROS 的电脑上接收 Neo HTTP 数据，再转换为标准话题。

当前提供范围
------------

当前公开客户端不依赖 ROS，现有仓库尚未提供已验收的完整 ROS 驱动包。
本页说明接入方式、字段映射和验收要求，下面话题是建议命名，不是设备已经发布的端点。
不要直接在设备上查找这些话题；需要先实现并运行电脑侧桥接节点。

准备与接入步骤
--------------

1. 按第二部分将 Neo 连接到运行 ROS 的电脑，并确认 HTTP 可访问。
2. 先用 :doc:`api-examples` 验证真实位置和图像，确认问题不在设备连接。
3. 在你的 ROS 工作空间中实现桥接节点，使用 rospy / roscpp 接入 ROS。
4. 用公开客户端解析 RBH1 数据流，再按下表转换消息；不能把二进制流当作单个 JSON。
5. 运行桥接节点后检查话题、频率、坐标、时间戳和图像显示。

建议的话题与消息
----------------

.. list-table::
   :header-rows: 1
   :widths: 28 32 40

   * - 建议话题
     - 消息类型
     - 映射注意
   * - /neo/odometry
     - nav_msgs/Odometry
     - HTTP位姿以IMU为参考；四元数填x/y/z/w
   * - /neo/image/compressed
     - sensor_msgs/CompressedImage
     - gray_jpeg对应JPEG；明确图像坐标系
   * - /neo/imu
     - sensor_msgs/Imu
     - 使用独立IMU通道；确认单位与时间戳

坐标与时间
----------

为局部定位父坐标系和 IMU 子坐标系定义明确的 frame_id/child_frame_id，例如 neo_odom、neo_imu。
相机光学系与 IMU 系需要正确的标定变换，不能简单把名字改成 base_link 当作机器人中心。
HTTP 速度按 IMU 坐标表达；世界坐标 Z 向上，初始航向不是地理北。

设备时间不能未经核对直接当作 ROS 系统时间。桥接端需定义设备时钟与主机/仿真时钟的关系；
若使用接收时间，应明确这是主机接收时刻，不是传感器采样时刻。保留原始时间和序号便于验证。
没有可靠协方差时，不能伪造“高置信度”；按消息定义和下游算法要求处理未知量。

运行后如何验证
--------------

.. code-block:: bash
   :caption: 仅在自行实现并启动桥接节点后使用，话题名随你的配置调整

   rostopic list
   rostopic echo -n 1 /neo/odometry
   rostopic hz /neo/odometry

再使用 RViz/RViz2 检查轨迹方向、TF关系和图像解码。平缓移动设备确认输出变化；
停止 VIO 或断开USB后，桥接不能继续发布旧位姿冒充新数据。
空位姿、重启后的序号回退、重连与退出时释放连接都需要测试。

ROS 1 还需确认 ROS_MASTER_URI、主机名/IP 可达，主节点与订阅节点使用兼容的消息定义。

.. container:: doc-next

   协议细节见 :doc:`api-guide`；消息字段来源见 :doc:`api-reference`。

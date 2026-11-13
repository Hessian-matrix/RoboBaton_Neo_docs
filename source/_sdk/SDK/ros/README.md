# ROS / ROS 2 里程计与图像示例

两个独立包使用同一个已安装的 robobaton_sdk；不复制 HTTP 协议，不依赖板内 IPC。发布 /neo/odometry (nav_msgs/Odometry) 和 /neo/source_header (std_msgs/String，原始设备 seq/stamp)。只接收，不启动 VIO、不发布 TF。

## 图像

两个包默认同时订阅 gray_jpeg，发布 /neo/image/compressed（sensor_msgs/CompressedImage）与 /neo/image/source_header（std_msgs/String，原设备 seq/stamp）。图像为 544×640 mono8 JPEG，format 为 mono8; jpeg compressed mono8，无需 OpenCV 或 cv_bridge。依赖 sensor_msgs。不发布原始 Image、CameraInfo、IMU 或 TF。

默认 image_frame=neo_camera_optical，采用 X向右/Y向下/Z向前的光学坐标，不是 IMU 坐标；frame 名字不能代替标定外参。图像 stamp 同样使用主机发布时间，原始 header 另发；各 topic 不是原子配对，图像与里程计是独立连接，未经同步不可用于精确融合。图像、位姿各保留最新一帧，慢消费者可能丢帧。JPEG 不解码重编码，源帧率模式不承诺固定发布频率。

ROS 1 检查：rostopic hz /neo/image/compressed；ROS 2 检查：ros2 topic hz /neo/image/compressed。可用支持 compressed transport 的图像查看器订阅；不要用普通 Image 订阅器直接读取 CompressedImage。停止相机或断开 USB 后应报错停止，不继续发布旧图像。

## 时间与坐标

header.stamp 使用主机发布时的 ROS 时钟，不把设备开机单调时间伪装成 UNIX 时间。原设备时间保留在 /neo/source_header，按 seq 识别原始样本；两个 topic 不是原子配对。有精确多传感器融合需求时，应先实现独立时钟同步，再扩展适配器。实物节点不应使用未运行的模拟 /clock。

默认 neo_world → neo_imu，速度在 neo_imu 系，四元数 x/y/z/w。只改 frame 名字不会执行坐标变换；不能将 neo_imu 改名 base_link 就宣称做过安装补偿。初始 yaw 不是地理 ENU，IMU 轴也不承诺 FLU。

设备不提供 covariance。两个 assumed_*_variance 参数默认 1000000，填 6×6 对角线，是保守示例假设而非估计质量；同时用于位置/角度或线/角速度，单位分别是 m²/rad² 和 (m/s)²/(rad/s)²。正式融合前应按机器人验证并修改适配器，不能把默认值视为实测噪声。null pose/twist/stamp 跳过，不补零。

网络在后台线程读取，主线程只发布最新一条；慢消费者可能丢帧，队列有界。断流后报错退出，不自动续接；源 seq 或时间倒退也退出，用户显式开启新会话。关闭时等待线程最多 0.5 秒，后台 socket 最多等待现有 10 秒读取超时，进程退出不被守护线程阻塞。

## ROS 1

在已有 ROS 1 工作区环境中（例如 Noetic，Python 3），用运行 ROS 节点的同一个 Python 安装 SDK：

~~~sh
python3 -m pip install -e /absolute/path/cv-610-pub/SDK/python
mkdir -p /your/catkin_ws/src
ln -s /absolute/path/cv-610-pub/SDK/ros/ros1/robobaton_neo /your/catkin_ws/src/robobaton_neo
cd /your/catkin_ws
catkin_make
source devel/setup.bash
roscore
~~~

另一终端加载相同环境运行：

~~~sh
rosrun robobaton_neo neo_odometry.py _origin:=http://192.168.11.1
rostopic echo /neo/odometry
~~~

## ROS 2

在已有 ROS 2 环境和工作区中，用相同系统 Python 安装 SDK，避免用不含 rclpy 的虚拟环境：

~~~sh
python3 -m pip install -e /absolute/path/cv-610-pub/SDK/python
mkdir -p /your/ros2_ws/src
ln -s /absolute/path/cv-610-pub/SDK/ros/ros2/robobaton_neo /your/ros2_ws/src/robobaton_neo
cd /your/ros2_ws
colcon build --packages-select robobaton_neo
source install/setup.bash
ros2 run robobaton_neo neo_odometry --ros-args -p origin:=http://192.168.11.1
ros2 topic echo /neo/odometry
~~~

两版参数相同：origin、image_frame、world_frame、imu_frame、assumed_pose_variance、assumed_twist_variance。主机单测覆盖转换及无效数据；ROS 构建、DDS 发现及机器人融合需在对应运行环境验证，不等同实机验收。

如果系统 Python 禁止全局 pip 安装，不要使用强制破坏系统环境的参数。可以不安装 SDK，在运行节点的终端执行 export PYTHONPATH=/absolute/path/cv-610-pub/SDK/python:$PYTHONPATH，仍使用原 ROS 自带 Python 环境。

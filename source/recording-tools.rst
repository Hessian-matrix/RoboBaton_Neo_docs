解析录制数据
============

下载与运行
----------

从 :doc:`sdk` 下载完整 SDK，解压后进入 SDK/recording。
需要 Python 3.8 或更新版本，无需第三方依赖。Windows 使用 python，Linux/macOS 可使用 python3。

.. code-block:: console

   cd SDK/recording
   python -m neo_recording inspect recording.tar
   python -m neo_recording check volume-001.zip volume-002.zip
   python -m neo_recording export recording.tar --output exported

支持 TF 卡下载的 TAR/TAR.GZ、浏览器录制 ZIP、解包后的录制目录和单个 RBR 段。
无需先解压，原文件不会被修改；导出目录必须不存在。
浏览器分卷检查请传入同一会话的全部 ZIP。单个 RBR 段只适合检查局部数据。

导出结果
--------

* report.json：检查报告、各通道计数、损坏位置和可用前缀长度。
* records.jsonl：逐条原始元数据、原始数据文件路径和视频流字节偏移。
* imu.csv、odometry.csv：段名、源代次、序号、秒、纳秒及完整 data_json。
* gray/、color/：原始 JPEG 或编码访问单元；H.264/H.265 另有逐段裸码流。
* 配置和标定：保留原有 manifest.json、result.json、mono.conf、calibration.json，以及每段配置。

CSV 的 data_json 保留原始字段，不插值、不补零、不改变坐标。IMU 加速度单位为 m/s²，
角速度单位为 rad/s。位姿坐标及参考点见 :doc:`sdk`。
设备时间是 CLOCK_MONOTONIC_RAW，不是 UTC；秒与纳秒保持分列，序号保持整数精度。
不同通道按接收顺序存储，不保证全局时间排序；不要把接收时间当作曝光时间。

如何判断数据是否完整
--------------------

inspect 与 check 都执行只读检查。退出码 0 表示所提供数据通过检查及完整性声明核对；
退出码 2 表示不完整、损坏或存在问题。即使退出码为 2，也可能导出损坏之前的有效记录，
必须同时查看 report.json。

* structurally_closed：段结构及结束记录通过检查。
* declared_complete：录制器在 result.json 中声明的本卷完整性。
* source_complete：源采集完整性；null 表示未知，不能推断无丢帧。
* issue_counts：问题总数；issues 最多列出 100 个详情，避免大包报告无限增长。
* terminal_volume_present：是否提供主动停止的末卷；只有自动分卷不能证明会话结束。

浏览器每卷有独立 recording_id，同一会话共享 session_id，volume 从 1 递增。
检查器报告缺卷、重复卷、序号缺口、时间倒退、计数不符和缺少标定快照。
CRC 正确只能证明读取的记录通过结构检查，不能证明断线期间没有遗漏数据。

视频与分卷
----------

H.264/H.265 导出为 Annex B 裸码流，不是 MP4。工具保留原始访问单元，不进行视频解码。
浏览器分卷可能从非随机访问帧开始，此时需要前一卷，或从下一有效随机访问帧开始解码。
只在编码配置、源代次及会话顺序一致时拼接；工具不会自动跨卷拼接。
播放器的名义帧率不能代替 records.jsonl 内的传感器时间戳。

Python 接入与验证
-----------------

.. code-block:: console

   python examples/read_recording.py recording.tar
   python tests/test_recording.py -v

Python 程序可使用 neo_recording.iter_records 逐条读取，载荷为原始 bytes；遇到损坏时抛出异常。
格式解析基于 v2.0.0，检查器测试使用合成数据，不代表实机录制或视频解码已经验收。
详见 SDK/recording/README.md。录制操作见 :doc:`recording`。

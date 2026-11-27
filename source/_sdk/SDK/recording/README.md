# Recording parser / 录制数据解析

Read-only host tool for the RBR1 recordings produced by Neo v2.0.0. Python 3.8+; standard library only. Run inside SDK/recording (Windows: python; Linux/macOS: python3).

Neo v2.0.0 的 RBR1 录制配套工具，只在电脑上运行。需要 Python 3.8+，无需安装第三方库。在 SDK/recording 中执行：

~~~sh
python -m neo_recording inspect recording.tar
python -m neo_recording check volume-001.zip volume-002.zip
python -m neo_recording export recording.tar --output exported
python examples/read_recording.py recording.tar
python tests/test_recording.py -v
~~~

Inputs: TF TAR/TAR.GZ, browser ZIP volumes, extracted directories, or individual .rbr/.rbr.part files. Archives are read without extraction. Input is never modified; export requires a new output directory. Pass all browser volumes from one session to check missing or duplicate volumes. Single segments cannot establish whole-recording completeness.

输入支持 TF TAR/TAR.GZ、浏览器 ZIP 分卷、解包目录、单个 .rbr/.rbr.part；直接读取归档，不必先解压。原文件保持不变，导出目录必须不存在。浏览器录制请传入同一会话的全部分卷；单段不能证明整个录制完整。

## Output / 输出

- report.json: segment CRC and valid prefix, channel counts, sequence gaps, timestamp regressions, completion declarations and session warnings. At most 100 issue details per recording; issue_counts retains total counts.
- records.jsonl: original metadata, segment name, payload file and optional video byte offsets. Integers remain exact; missing values remain null.
- imu.csv, odometry.csv: segment, source_epoch, seq, stamp_sec, stamp_nanosec, data_json. data_json preserves the entire sample, including units/coordinates defined by the public API. No interpolation or coordinate conversion.
- gray/ and color/: original JPEG frames or encoded access units. H.264/H.265 also produce stream-NNNN.h264/h265 per segment/epoch/subscription. These are Annex B streams, not MP4. Unknown formats remain .bin.
- manifest.json, result.json, mono.conf, calibration.json (when present), and per-segment config snapshots.

输出含检查报告、逐条元数据、IMU/里程计 CSV、原始图像、H.264/H.265 裸码流及原有配置/标定。CSV 的 data_json 保留完整样本；不插值、不改变坐标、不把空值补零。时间戳是设备单调时钟，不是 UTC；保留秒与纳秒两列，避免浮点精度损失。

## Completeness / 完整性

inspect and check perform the same read-only validation. Exit 0 means the supplied volumes meet the tool's checks and their completion declarations; 2 means a missing/incomplete/damaged input or a reported issue. valid does not establish lossless source capture. structurally_closed only establishes valid segment termination. declared_complete comes from result.json; source_complete may be null (unknown). A contiguous prefix ending with volume_rollover is not a completed session. Reports retain exportable valid prefixes even when the final result is incomplete; a fatal input error creates FAILED.txt.

inspect 和 check 都执行同样的只读检查。退出码 0 表示所提供数据通过检查和完整性声明核对，2 表示不完整、损坏或存在问题。段正常结束不等于源数据无丢失；source_complete=null 表示未知。最后一卷仍为 volume_rollover 时不能判断整个会话已结束。损坏尾部前通过校验的记录可导出，必须结合 report.json 使用。

Video export does not decode or validate the codec bitstream. A browser volume may start before a random-access frame: retain the preceding volume or begin decoding at the next valid random-access frame. Only concatenate streams after verifying matching codec/configuration, session order and epochs. The tool does not silently concatenate volumes. Source timestamps remain in records.jsonl; a player's nominal frame rate is not sensor timing.

视频导出不做解码或码流有效性验收。浏览器分卷可能从非随机访问帧开始，需保留前卷或从下一有效随机访问帧解码。确认配置、会话顺序和 epoch 一致后才可拼接；工具不会自动跨卷拼接。播放器帧率不能代替 records.jsonl 中的真实传感器时间。

The regression fixtures are synthetic. Passing them is not device, real-video, ROS or flight-controller acceptance.

回归采用合成格式样本，通过不代表实机录制、真实视频、ROS 或飞控验收。

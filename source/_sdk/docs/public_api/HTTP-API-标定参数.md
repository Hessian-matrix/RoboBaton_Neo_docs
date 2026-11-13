# 标定参数

接口返回有效标定参数及来源。2026-11-08 增加代码默认参数回退；本次回归和构建结果见[默认标定参数验证](../默认标定参数验证-2026-11-08.md)，实机定位精度需单独验收。

## 接口

- GET /api/calibration/parameters：200返回完整有效参数和只读 source（default 或 saved）。无正文；文件不存在时使用代码默认值，文件损坏、不可读、非普通文件或符号链接返回500/CALIBRATION_LOAD_FAILED。
- POST /api/calibration/parameters：application/json；唯一Content-Length；1~4095字节。完整替换，200返回保存后的参数。400非法参数，409占用，413过大，408不完整/超时，500保存结果未确认。失败响应仅含 error.code。成功返回 source=saved；请求中携带 source 返回400。

POST 请求示例（仅结构示意，不是实机标定；GET/POST 成功响应在此基础上增加 source 字段）：

```json
{
  "camera": {
    "model": "ds",
    "width": 544,
    "height": 640,
    "intrinsics": {
      "fx": 300, "fy": 301,
      "cx": 271.5, "cy": 319.5,
      "xi": 0.5, "alpha": 0.6
    }
  },
  "T_cam_imu": [
    [0, -1, 0, 0.01],
    [1,  0, 0, 0.02],
    [0,  0, 1, 0.03],
    [0,  0, 0, 1]
  ],
  "camera_imu_time_offset_s": -0.002,
  "imu": {
    "sample_rate_hz": 200,
    "gyroscope_noise_density": 0.0001,
    "gyroscope_random_walk": 0.00001,
    "accelerometer_noise_density": 0.001,
    "accelerometer_random_walk": 0.0001
  }
}
```

model仅ds；无distortion字段。fx/fy/cx/cy单位像素，xi/alpha无量纲，fx/fy>0、0<alpha<1。分辨率是VIO图像544×640，不可直接作为全分辨率图像内参。

T_cam_imu：IMU→相机，p_camera=R*p_imu+t，t为IMU原点在相机系的位置（米）。相机X右/Y下/Z前；IMU轴沿用原始数据定义。外参需正交、det=+1（容差1e-5），末行[0,0,0,1]（容差1e-9）。生成mono.conf时使用逆变换 R^T,-R^T*t，逆平移各分量≤10 m。不是仅更换名称。

camera_imu_time_offset_s：t_imu=t_camera+offset，秒，允许±0.1 s；不改原始时间、不重复补偿。IMU采样率固定200 Hz，说明1600/8平均后的数据规格，不是配置硬件采样率。四个噪声量分别为(rad/s)/√Hz、(rad/s)/√s、(m/s²)/√Hz、(m/s²)/√s，必须有限且>0，不等同于当前零偏。

拒绝缺失/未知/重复字段、非有限值、字符串数字、布尔数字、错误矩阵。所有运行文件在提交前均经实际VIO加载器校验。最后写入者生效；未新增版本号或并发编辑冲突协议。

## 单一文件与运行互斥

唯一运行文件 /home/VIO/parameters/mono.conf。GET、VIO 启动预检和算法入口、深度几何、光心安装换算及 TF 录制快照共用有效参数加载器：合法文件优先，仅不存在时整体回退默认值；不做字段级拼接。API的JSON不另外持久化。内部文件仍保留算法旧字段（DS的xi/alpha存入distortion_coefficients前两项）；不代表公开API支持额外畸变。

POST与VIO命令受理、录制开始互斥，并取得VIO全生命周期排他锁和录制锁。VIO在读取配置前取得共享锁；运行/启停中409。TF录制和预检、深度或标定采集占用期间409；预览、彩色和原始IMU可继续。

写同目录临时文件，fsync后rename，目录fsync；正式路径只出现完整旧版或完整新版。临时文件不参与加载。若rename后耐久性确认失败，500明确要求GET核对，不能声称一定未保存。GET读取打开的文件快照。录制包保留当时有效参数的 mono.conf，并在 manifest.json 写入 calibration_source=default|saved；不会将默认快照写回设备标定路径。运行任务持有启动快照，保存后的参数在下一次启动使用。

## 默认值与来源

单一数值定义为 calibration/configs/guidance-camera.json。calibration/generate-defaults.py 生成 C 常量及 IMU 参考配置，构建检查生成物一致性；网页采集指导固定使用同一参考，不跟随已保存标定。

| 项目 | 默认值 |
|---|---|
| 模型 / 图像 | DS / 544×640 |
| fx / fy | 219.397117 / 217.800579 px |
| cx / cy | 272 / 320 px |
| xi / alpha | -0.084097 / 0.573236 |
| T_cam_imu 旋转 | [[0,-1,0],[1,0,0],[0,0,1]] |
| T_cam_imu 平移 | [0.007399,0.023017,-0.007015] m |
| 时间偏移 | 0 s（默认假设，非实测延迟） |
| IMU 采样率 | 200 Hz |
| 陀螺噪声 / 随机游走 | 6.41790173624e-5 / 1.2001426432e-5 |
| 加计噪声 / 随机游走 | 0.000568661371658 / 0.000588461703004 |

不固定算法估计的 bias、重力或初始化结果。默认外参是硬件名义值，不能代替单机标定。

GET 返回 source=default 不是完成标定或保存成功。默认值只在内存中选择，不自动生成 mono.conf；合法文件的全部数值优先，包括实测时间偏移。损坏文件不降级，避免掩盖配置错误。

## 网页与普通主控

公开标定页提供“设备标定参数”折叠区，可读取当前 JSON；本次设备采集完成求解后通过  保存。浏览器验证求解来源、完整报告和归档一致性；保存前等待本页闲置采集后台及灰度/IMU 读流释放，启动准备期间不允许保存。POST 后独立 GET 确认 source=saved 且参数数值一致才允许完成标定；写入结果不确定时先查询，不自动重发，失败保留结果。下次 VIO 启动读取新参数。2026-11-05 收尾修复仅完成主机与浏览器回归，尚未部署，见[核查记录](../标定采集释放与保存流程核查-2026-11-05.md)。

Python：tools/http-api/client.py 的 Device.calibration_parameters() 读取；传入完整dict保存。字段验证在calibration.py；回读对象重新提交时客户端去除只读source字段。网页持续提示默认来源，不自动保存默认值。网页、Python和板端保持T_cam_imu相同方向。

## 验证

2026-11-04 本机验证记录：

| 验证 | 结果 |
| --- | --- |
| bash tmp/test-public-calibration.sh（Linux/WSL，Python需jsonschema） | ASan/UBSan、-Werror构建；12项通过 |
| node --test tmp/test-public-calibration.cjs | 4项通过；浏览器模型、字段与请求处理 |
| node tmp/test-public-calibration-ui.cjs | 通过；真实网页、模拟板端响应 |
| python -m unittest discover -s visualization/tests -p "test_*.py" | 15项通过 |
| node --test visualization/tests/browser-runtime.test.cjs | 4项通过 |
| bash tmp/test-http.sh / tmp/test-public-color.sh / tmp/test-public-mount.sh / tmp/test-tf-.sh | 预览、VIO、IMU、彩色、安装和TF本机回归通过 |
| bash tmp/build-http.sh；公开驱动CMake目标robobaton-neo-driverd | ARM Release交叉编译通过 |
| 内部bridge的-Werror语法检查；bash tmp/test-http-config.sh | 通过；v2配置回归保持原行为 |

12项接口测试覆盖90°非单位旋转与非零平移、时间符号、非法/重复字段、坏文件、写入失败、服务重启、VIO/录制锁、命令受理窗口、进程占用、并发读取完整性、迁移优先级/重复执行及OpenAPI响应schema。测试文件和产物仅在tmp。

网页测试使用 tmp/public-calibration/web 的公开构建：1440/390/320 px × 中英文 × 明暗主题共12组布局无溢出；读取成功、404以及打开合成的已完成标定包后保存均通过。409时保留结果，用户再次点击才重试；没有发出v2标定请求或VIO启停命令。报告与截图在tmp/public-calibration/ui。合成数据只验证数据流，不代表标定精度通过。

旧 parameter-publication.test.js 的8项通用发布回归通过；1项历史导出逐字节比较未完成：仓库缺少 comparison/parameter-publication-20260930/bundle.json 等冻结基准。需恢复原始基准后重跑，不能用新生成数据代替历史基准。运行此旧测试需将其 test-artifacts 目录临时链接到仓库tmp，测试后移除链接。

实机已验证：迁移真实设备后回读一致；停止状态保存后启动VIO使用唯一文件；运行中409；预览/彩色/IMU连续性；软件部署保留参数。TF卡当前unavailable，快照与录制占用保护仍待真实写卡验证；断电耐久性和完整固件升级流程也未验收。

建议实机按以下顺序验证，使用设备真实标定值，不使用上方示意数字：

1. 停止VIO及录制，安装同版本程序并迁移；GET回读，对照原始参数与外参逆矩阵。
2. 停止状态POST回读到的完整参数，确认200，板端仅唯一mono.conf更新；重启服务后GET相同。
3. 开启VIO后POST相同参数，确认409，文件校验和不变，VIO持续运行。停止VIO后再次保存应为200。
4. 单独开启预览、彩色、IMU输出后保存，确认200且已有流连续；新参数在下次VIO启动加载。
5. 开启TF录制时保存应409；停止并下载录制包，确认其中mono.conf保留录制当时快照。
6. 将alpha改成1或删除T_cam_imu，确认400且原文件不变；再次部署软件，确认标定未被覆盖。

系统重启并发约束（2026-11-09）：本模块的业务变更/配置写入在系统重启已受理或重启状态存储异常时返回409 REBOOT_BUSY；先查询[系统状态](HTTP-API-系统.md)，不自动重复变更。普通状态查询保持可用。

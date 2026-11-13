# JPEG 灰度与浏览器录制

现有preview、gray、color、imu、odometry语义不变。实现、主机测试和实机验证分开记录。

## JPEG 灰度流

GET /api/stream?channels=gray_jpeg，无额外启动或配置请求。最多3个公开连接，超出429 STREAM_LIMIT；源未就绪503 GRAY_UNAVAILABLE/GRAY_NOT_READY，内存不足503 OUT_OF_MEMORY。每连接一个通道；200之后的错误通过结束连接表示，客户端丢弃未完整消息。

HTTP chunked响应，先解HTTP分块再解析40字节小端RBH1；单片最多65536字节。新channel=6、format=7，复用彩图帧前缀形状，但不改变彩图配置。

首条控制JSON为 type=metadata、api_version=3、connection_id=gray_jpeg、stream.source.type=live、stream.channels=[{id:6,name:gray_jpeg,format:7}]，config如下：

    {"encoding":"jpeg","pixel_format":"mono8","width":544,"height":640,"quality":90,"frame_rate_mode":"source"}

pixel_format是灰度像素语义；硬件用中性UV的NV21输入，因此JPEG可含三分量，不能假设文件只有单分量。固定544×640、Q90；frame_rate_mode=source，不承诺恒定帧率。通常独立约60fps、VIO接管约30fps，实际需测量。源切换可结束连接，不保证跨切换连续。

完整消息：uint32小端JSON长度N（1..508）＋UTF-8 JSON＋JPEG（1..1048576字节），上限1049088字节。前缀示例：

    {"header":{"seq":"124","stamp":{"sec":146,"nanosec":543970875}},"pts_us":null,"random_access":true}

seq是驱动该灰度输出真实序号，uint64十进制字符串，非RBH1传输号。stamp为与IMU同域的CLOCK_MONOTONIC_RAW曝光中点，未关联时null，不填接收时间。JPEG pts_us=null、random_access=true。公共帧不虚构sensor ID或epoch；源/流epoch变化、序号缺口或有效时间倒退结束连接。

首次最多8秒，后续源读取3秒，完整消息全部分片共享1秒发送期限。距采集超过500ms：首次丢弃等新图，开始后结束连接，不隐瞒缺口。断开只释放自身引用；重连重新发送元数据与完整JPEG，不补历史。

驱动46015仅loopback，与TF 46008共用一次编码；网络队列最多一帧、发送缓冲64KiB，TF队列最多8帧。先服务TF，再服务网络。最多3个外发，保留至少1个板内订阅槽；帧池不足先清慢外发引用。HTTP线程nice10。不能保证满载零开销，编码或总体资源不足仍会结束录制。

Python：python tools/http-api/client.py http://192.168.11.1 --channel gray_jpeg --messages 30。网页public-gray-jpeg.js和Python均校验边界、时间、序号、配置与JPEG完整结束。

## 浏览器录制流程

USB表示USB网络拉流并在当前浏览器临时保存。gray→gray_jpeg、imu→imu、color→color、odometry→odometry，四项独立选择、独立连接。不创建板端browser任务，不调用POST /recording，不更改按键预设。

开始固定本次channels，GET /calibration/parameters，保存calibration.json，生成参数等价mono.conf。T_cam_imu求逆后写入cam0_camera_T_BS_row_major，保留DS/噪声/时间偏移。不是原文件字节复本，不保留注释，不伪造原文件哈希。

所有选中源提供有效样本后开始；有彩图时等实际random_access帧及参数集。各路首样本时间不同，按采集时间对齐；开始窗口外样本不属录制区间。10秒不就绪失败。里程计无有效pose/twist/stamp、图像无有效曝光时间时结束，不造零位姿或时间。

逐通道序号必须连续。停止只关闭录制自己的连接，保留VIO/预览。断网、缺口、源或编码配置变化、超时、容量耗尽保留前缀并标记不完整，不自动重连拼接。IMU外发优先级低导致的缺口不能通过提高网络优先级掩盖。

录制中可编辑下次选项或切换查看USB/TF状态；停止针对当前显示目标。实际任务内容另列，不被勾选覆盖。TF直接POST /recording携带channels；实体按键独立配置、固定TF。预检仍阻止开始新录制。

## 格式与可靠性边界

ZIP包含录制ID目录：manifest.json、calibration.json、mono.conf、segments/000001.rbr等、result.json。TF仍下载TAR；解包后的RBR1头、记录头、小端、CRC、通道号一致。灰度磁盘通道仍为5，不使用网络通道6。JPEG/H26x原编码保存，不转码。

段约256MiB或60秒；H26x等待下一彩图随机访问帧切段。每段重复本次配置。采用分块数组避免每次追加复制整段；CRC为IEEE CRC32。公开流没有提供的source_epoch/stream_epoch/source_id_legacy写null，不造值。

manifest.calibration_snapshot.scope=read_before_subscription、locked=false。结束再次GET比较，变化或不能核对则不完整；前后相同不能证明中间没有改动再恢复。没有板端浏览器任务锁，不宣称原子冻结。result.source_complete=null、completeness_scope=received_subscription_interval；complete只表示接收区间连续且成功收尾，不表示全部传感器采集无损。

页面全部录制数据预算256MiB，含已结束但未移除的记录；留出收尾空间，下载并移除后释放。浏览器对象和下载Blob有额外开销，非进程内存上限。当前页面内存保存，刷新/关闭丢失，离开提示不能防止手机系统强杀。无IndexedDB自动持久化，手动下载，不将下载请求当成已写入磁盘。

离线：python tools/http-api/recording_rbr.py <解包后的ID目录>，TF/浏览器共用解析器；不直接传ZIP/TAR。必须连同scope理解complete。

## 按键页

顶部刷新读取GET /buttons/config整份配置；脏草稿先提示覆盖，失败保留编辑。保存并生效完整POST并核对回执；失败显示未确认。录制中可保存新预设，当前任务不变。无复制、同步或自动改变实时视图保存位置。

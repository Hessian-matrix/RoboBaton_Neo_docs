# JPEG 灰度与浏览器录制

浏览器录制占用其实际订阅的 HTTP 图像通道，遵循单客户端及共载规则。详见[原灰档位与图像互斥规则](HTTP-API-灰度.md)。


现有preview、gray、color、imu、odometry语义不变。实现、主机测试和实机验证分开记录。

## JPEG 灰度流

GET /api/stream?channels=gray_jpeg，无额外启动或配置请求。同一时间仅允许一个公开订阅，重复订阅返回 409 IMAGE_CONFLICT，原订阅继续工作；源未就绪503 GRAY_UNAVAILABLE/GRAY_NOT_READY，内存不足503 OUT_OF_MEMORY。每连接一个通道；200之后的错误通过结束连接表示，客户端丢弃未完整消息。

HTTP chunked响应，先解HTTP分块再解析40字节小端RBH1；单片最多65536字节。新channel=6、format=7，复用彩图帧前缀形状，但不改变彩图配置。

首条控制JSON为 type=metadata、api_version=3、connection_id=gray_jpeg、stream.source.type=live、stream.channels=[{id:6,name:gray_jpeg,format:7}]，config如下：

    {"encoding":"jpeg","pixel_format":"mono8","width":544,"height":640,"quality":90,"frame_rate_mode":"source"}

pixel_format是灰度像素语义；编码输入为CH2的YUV400（Y8），硬件输出的JPEG仍可含三分量，不能假设文件只有单分量。固定544×640、Q90；frame_rate_mode=source，不承诺恒定帧率。通常独立约60fps、VIO采集约30fps，实际需测量。不同帧率的源接管仍可能被拒绝；源切换可结束连接，不保证跨切换连续。JPEG只发布与实际采集帧PTS精确匹配的时间和曝光元数据；HTTP继续独立复制码流，不共享VIO图像地址。

完整消息：uint32小端JSON长度N（1..508）＋UTF-8 JSON＋JPEG（1..1048576字节），上限1049088字节。前缀示例：

    {"header":{"seq":"124","stamp":{"sec":146,"nanosec":543970875}},"pts_us":null,"random_access":true}

seq是驱动该灰度输出真实序号，uint64十进制字符串，非RBH1传输号。stamp为与IMU同域的CLOCK_MONOTONIC_RAW曝光中点，未关联时null，不填接收时间。JPEG pts_us=null、random_access=true。公共帧不虚构sensor ID或epoch；源/流epoch变化、序号缺口或有效时间倒退结束连接。

首次最多8秒，后续源读取3秒，完整消息全部分片共享1秒发送期限。距采集超过500ms：首次丢弃等新图，开始后结束连接，不隐瞒缺口。断开只释放自身引用；重连重新发送元数据与完整JPEG，不补历史。

JPEG 网络订阅为尽力输出；满载或资源不足时可能断流，录制结果必须检查缺口和完整性。

Python：python tools/http-api/client.py http://192.168.11.1 --channel gray_jpeg --messages 30。网页public-gray-jpeg.js和Python均校验边界、时间、序号、配置与JPEG完整结束。

## 浏览器录制流程

USB 在浏览器中通过独立连接订阅 gray_jpeg、imu、color、odometry 的所选子集。无需板端录制请求，不改变 TF、实体按键或 VIO。开始时最多等待约两秒读取标定参数；读取失败也录制，manifest.calibration_file 为 null，不生成虚假的 mono.conf 或 calibration.json。

网页尽力接收，不等所有通道就绪。每路单独重试订阅（0.5 到 8 秒退避）；连接结束、协议无法继续或约 10 秒无样本时重连该路。全部离线仍保持会话，手动停止时取消重连。序号跳跃、重复、倒退、非递增时间不结束任务，保留原值。允许图像曝光时间为 null；非法样本不写入。记录 metadata 的 subscription_index 从 1 开始，received_offset_ms 为相对会话开始的接收时间，不能替代源时间。不跨订阅推算缺失数量。

## 自动分卷与容量

无 256 MiB 累计上限。对已有数据的卷，RBR 数据约 256 MiB 或卷时长 10 分钟，先到者触发封卷；每卷一个 ZIP（阈值不计 ZIP 封装）；H.264/H.265 优先在随机访问帧处分卷，约 264 MiB 或 10 分 2 秒仍未遇到关键帧也切卷，遇到非关键帧开头须连同前卷解码或等下一关键帧。彩图配置变化也会切卷。每卷有独立 recording_id、相同 session_id 和递增 volume（从 1 开始），包含 manifest.json、result.json、有数据时的 segments/000001.rbr 和可用的标定快照。RBR1 布局与 TF 不变。配套 SDK/recording 可直接读取归档或解包目录。

ZIP 和目录项在网页来源的 IndexedDB 同一事务提交。已提交的卷可以边录边下载，同浏览器同地址刷新后仍可找回；清理站点数据会删除它们。页面关闭时未封存的尾卷可能丢失。写入失败的卷暂留内存，可下载并移除；待写和仅内存卷累计约 96 MiB 后限制继续缓冲；只有一个分卷正在首次提交时，允许下一卷再接收约 96 MiB，避免正常切卷产生缺口。超过缓冲预算时不再堆积：仍订阅，计数未写入样本，缓冲恢复后继续写。最终容量受浏览器实际配额和磁盘空间限制。

result.end_reason 为 volume_rollover（自动分卷）或 user_stop（主动停止），与完整性独立。complete 是本卷已知完整性；source_complete=null，不保证源无损。未收到所选通道、无标定快照或观察到异常时不报本卷完整；最后停止时尽力核对标定，其他卷不锁定、不验证中途改参。session_has_known_issues 累计到本卷，session_counts 为截至封卷时的累计写入数量，counts 为本卷数量。session_offset_s、duration_s 单位为秒。channel_issues 按通道统计 missing（同一订阅内已知跳过的序号数，十进制字符串）、sequence_resets（重复或倒退）、time_anomalies、invalid、interruptions、storage_dropped（其余为非负数）。断线期间漏掉多少样本未知。例如收到 IMU 100、103 后主动停止：end_reason=user_stop，counts.imu="2"，channel_issues.imu.missing="2"，complete=false。

## 按键页

顶部刷新读取GET /buttons/config整份配置；脏草稿先提示覆盖，失败保留编辑。保存并生效完整POST并核对回执；失败显示未确认。录制中可保存新预设，当前任务不变。无复制、同步或自动改变实时视图保存位置。



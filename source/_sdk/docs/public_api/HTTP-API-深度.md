# 二维相对深度

2026-11-05。新增 GET /api/depth/config，现有 stream 增加 depth 通道。共31个方法/路径操作、7路流。实现与实机验收分别记录。

## 生命周期

GET /api/stream?channels=depth 持有独立订阅，首个消费者启动驱动与共享 NPU 深度程序，最多4个消费者共享一次推理。设备服务通过本机 NDS1 持有连接租约，图像走 /run 原子发布的最新 RBD4 文件，不经控制 IPC 搬运大帧。新增设备服务管理线程，复用既有深度进程。断开最后一个消费者后有3秒宽限，随后停止推理、释放 CH3；驱动按自身引用管理共享 CH1，不关闭其他预览或 VIO。

网页进程退出会释放它持有的深度订阅；这项功能按观看需求运行，不承诺网关重启期间持续推理。设备服务崩溃后，现有推理程序30秒租约到期退出，其文件锁防止重叠启动；此期间连接可以明确失败后重试。深度进程异常结束导致当前连接关闭，不对旧连接静默换世代。设备服务不负责重启 VIO。

VIO启停与深度独立。普通TF录制允许共载，录制预检与深度互斥，避免混入未纳入预检缓存键的负载。深度运行及3秒宽限期间拒绝标定保存和应用更新；关闭深度后再执行。读取配置只读，不启动驱动、推理或续租；驱动配置不可用返回503。

## 配置

GET成功为200 JSON，例如（裁剪以真实设备为准）：

~~~json
{"config_id":"0123456789abcdef","encoding":"raw","width":384,"height":384,"fps":5,"dtype":"float32","byte_order":"little","layout":"row_major","value_type":"relative","unit":null,"polarity":"unverified","pixel_mapping":"half_pixel","source_size":{"width":544,"height":640},"crop":{"x":58,"y":106,"width":428,"height":428}}
~~~

fps 是上限而非实时测量。config_id 沿用板内有效 float32 几何快照 FNV-1a64 标识，仅用于匹配，不是安全校验。crop是544×640未旋转预览网格中的像素边界，映射为 x+(u+0.5)*width/384-0.5，y同理。相机内外参继续由独立标定接口管理，本配置不提供临时拼装的 CameraInfo，不声明可作米制投影。

每条流第一条RBH1 channel0/format1为metadata：

~~~json
{"type":"metadata","connection_id":"depth","stream":{"source":{"type":"live"},"channels":[{"id":7,"name":"depth","format":9}]},"source_epoch":"123","stream_epoch":"456","config":{"...":"上述完整配置"}}
~~~

source_epoch/stream_epoch均为uint64十进制字符串；分别标识采集源和深度输入通道，不是VIO轨迹标识。connection_id仅兼容流入口，不是全局唯一身份。配置读取、订阅与首帧存在竞态时，网关必须核对板内RBD4帧头config_id；不匹配拒绝此次连接，不猜用最新配置。外发帧不重复config_id，客户端以同连接的metadata为准。运行期间配置、源或通道世代变化结束连接。重连始终重发metadata。

## 帧：RBH1 channel7 / format9

HTTP/1.1 Content-Type: application/vnd.robobaton.stream，chunked传输；RBH1仍为40字节小端头，每分片最多65536字节。完整业务消息：

| 偏移 | 类型 | 内容 |
|---|---|---|
| 0 | uint32 LE | 帧JSON长度N，1～252 |
| 4 | N字节UTF-8 | 下述帧信息 |
| 4+N | 589824字节 | 384×384 float32 LE，行优先、无填充 |

消息最大590080字节。禁止把HTTP chunk/TCP read当业务帧。线上布局显式序列化，不发送C原生结构或Base64。

~~~json
{"header":{"seq":"123","stamp":{"sec":146,"nanosec":543970875}},"pts_us":"146550000"}
~~~

seq为深度程序输出uint32序号的十进制字符串，从1递增，允许跳号，回绕结束连接；不等于传感器帧号或RBH1连接内序号。pts_us为输入图像原始MPP PTS uint64字符串。stamp为输入图像CLOCK_MONOTONIC_RAW曝光中点，纳秒0～999999999，组合不超过INT64_MAX；未同步为null，不能用推理完成或接收时间冒充。

像素原样保留包括NaN/Inf，客户端将非有限数视为不可显示；有限负数不擅自截断。无JPEG/H26x编码和帧间依赖，无random_access字段。589824字节×5Hz约2.95MB/s、23.6Mbit/s，不计封装。

外发每客户端只有一个当前完整帧，读取RAM最新帧，允许跳过未发送帧，不回放旧数据。每帧全部分片共享1秒发送期限，超时断开，绝不发送半帧后跳到下一帧。首帧等待最多20秒（另有设备准备请求），后续3秒无新帧断开；只接受修改时间不超过1秒的RAM文件。共享推理与其他消费者不等待慢客户端。

HTTP头发送前错误仅 {"error":{"code":"..."}}：503 DEPTH_CONFIG_UNAVAILABLE、DEPTH_UNAVAILABLE、DEPTH_NOT_READY、OUT_OF_MEMORY、SOURCE_UNAVAILABLE；429 STREAM_LIMIT；409 UPDATE_BUSY/CHECK_ACTIVE。HTTP200及metadata发出后故障关闭连接，不能再返回另一个HTTP状态。

## 网页和Python

独立depth-view.js和browser/public/depth-model.js；Worker仅生成伪彩图，不影响原始数据。按有效像素2%～98%分位作逐帧显示归一化，颜色仅表示本帧数值大小，极性未确认，不标近/远或距离。无有效范围显示黑色，不把无效值当零距离。

启动/停止单按钮；启动默认打开浮窗，隐藏/切页仅停止绘制，显式停止释放订阅。关闭页面和切设备清空连接、Worker和旧帧。断线500ms～5s退避重连，配置先行；帧中断清图，不显示冻结画面冒充实时。Worker最多一帧处理中、一帧待处理，忙时覆盖旧待处理帧。中英文、窄屏、明暗沿用独立公开样式。

~~~sh
python tools/http-api/client.py http://192.168.11.1 --depth-config
python tools/http-api/client.py http://192.168.11.1 --channel depth --messages 30
~~~

该流是实时显示/接收接口，不是无损录制协议。相对深度非米制、远近极性未验证。NPU与VIO有共享资源，功能接通不代表VIO无性能损失；本轮数据见[验证报告](../HTTP-API-深度验证-2026-11-05.md)。

深度几何与 VIO 共用有效标定参数加载器：合法 mono.conf 优先，缺失使用代码固化默认值，损坏拒绝启动。几何在深度会话启动时固定；未标定时上色/点云采用名义参数，不代表准确标定。默认值与来源由 GET /api/calibration/parameters 查询。

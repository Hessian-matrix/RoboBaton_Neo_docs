# 二维相对深度

depth 只允许一个外部图像订阅。VIO 与原灰 30 或高于 5 fps 的全分辨率彩色同时在用时，新 depth 请求返回409 IMAGE_CONFLICT。详见[原灰档位与图像互斥规则](HTTP-API-灰度.md)。


2026-11-05。新增 GET /api/depth/config，现有 stream 增加 depth 通道。共31个方法/路径操作、7路流。实现与实机验收分别记录。

## 生命周期

GET /api/stream?channels=depth 启动深度订阅，每个通道最多一个外部客户端。最后一个订阅退出后保留 3 秒重连宽限，随后停止深度，不停止其他预览或 VIO。

网页进程退出会释放它持有的深度订阅；这项功能按观看需求运行，不承诺网关重启期间持续推理。设备服务崩溃后，现有推理程序30秒租约到期退出，其文件锁防止重叠启动；此期间连接可以明确失败后重试。深度进程异常结束导致当前连接关闭，不对旧连接静默换世代。设备服务不负责重启 VIO。

VIO启停与深度独立。普通TF录制允许共载，录制预检与深度互斥，避免混入未纳入预检缓存键的负载。深度运行及3秒宽限期间拒绝标定保存和应用更新；关闭深度后再执行。读取配置只读，不启动驱动、推理或续租；驱动配置不可用返回503。

## 配置

GET成功为200 JSON，例如（裁剪以真实设备为准）：

~~~json
{"config_id":"0123456789abcdef","encoding":"raw","width":384,"height":384,"fps":5,"dtype":"float32","byte_order":"little","layout":"row_major","value_type":"relative","unit":null,"polarity":"unverified","pixel_mapping":"half_pixel","source_size":{"width":544,"height":640},"crop":{"x":58,"y":106,"width":428,"height":428}}
~~~

fps 是上限而非实时测量。config_id 是配置标识，仅用于匹配，不是安全校验。crop是544×640未旋转预览网格中的像素边界，映射为 x+(u+0.5)*width/384-0.5，y同理。相机内外参继续由独立标定接口管理，本配置不提供临时拼装的 CameraInfo，不声明可作米制投影。

每条流第一条RBH1 channel0/format1为metadata：

~~~json
{"type":"metadata","connection_id":"depth","stream":{"source":{"type":"live"},"channels":[{"id":7,"name":"depth","format":9}]},"source_epoch":"123","stream_epoch":"456","config":{"...":"上述完整配置"}}
~~~

source_epoch/stream_epoch均为uint64十进制字符串；分别标识采集源和深度输入通道，不是VIO轨迹标识。connection_id仅兼容流入口，不是全局唯一身份。配置发生变化时可拒绝订阅；客户端应重新连接，使用同一连接的元数据。外发帧不重复config_id，客户端以同连接的metadata为准。运行期间配置、源或通道世代变化结束连接。重连始终重发metadata。

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

深度帧像素与元数据在发送期间保持一致。源序号允许跳号，不补发历史；慢连接会结束，客户端需重新订阅。

每个槽从首次入队开始计1秒总排队／发送预算，全部分片共用该绝对期限；等待帧替换及晋升不刷新期限。超时结束连接，绝不发送半帧后拼接另一帧。首帧等待仍最多20秒（另有设备准备请求），后续3秒无可发送帧结束；快照修改时间仍须不超过1秒。重复快照先在独立64字节帧头中核对，不改写已排队像素；同序号但头部变化、配置／源世代变化、序号／PTS／有效时间倒退均结束连接。共享推理和其他消费者不等待慢客户端。



2026-11-17：上述双帧改动已完成主机受控阻塞和协议回归，尚未部署实机；不代表此前DEPTH_NOT_READY已解决。见各路图像队列说明（详见产品说明）。

HTTP头发送前错误仅 {"error":{"code":"..."}}：503 DEPTH_CONFIG_UNAVAILABLE、DEPTH_UNAVAILABLE、DEPTH_NOT_READY、OUT_OF_MEMORY、SOURCE_UNAVAILABLE；429 STREAM_LIMIT；409 IMAGE_CONFLICT/UPDATE_BUSY/CHECK_ACTIVE。HTTP200及metadata发出后故障关闭连接，不能再返回另一个HTTP状态。

## 网页和Python

独立depth-view.js和browser/public/depth-model.js；Worker仅生成伪彩图，不影响原始数据。按有效像素2%～98%分位作逐帧显示归一化，颜色仅表示本帧数值大小，极性未确认，不标近/远或距离。无有效范围显示黑色，不把无效值当零距离。

启动/停止单按钮；启动默认打开浮窗，隐藏/切页仅停止绘制，显式停止释放订阅。关闭页面和切设备清空连接、Worker和旧帧。断线500ms～5s退避重连，配置先行；帧中断清图，不显示冻结画面冒充实时。Worker最多一帧处理中、一帧待处理，忙时覆盖旧待处理帧。中英文、窄屏、明暗沿用独立公开样式。

~~~sh
python tools/http-api/client.py http://192.168.11.1 --depth-config
python tools/http-api/client.py http://192.168.11.1 --channel depth --messages 30
~~~

该流是实时显示/接收接口，不是无损录制协议。相对深度非米制、远近极性未验证。深度与VIO共享设备资源，功能接通不代表VIO无性能损失；本轮数据见验证报告（详见产品说明）。

深度几何与 VIO 共用有效标定参数加载器：合法 mono.conf 优先，缺失使用代码固化默认值，损坏拒绝启动。几何在深度会话启动时固定；未标定时上色/点云采用名义参数，不代表准确标定。默认值与来源由 GET /api/calibration/parameters 查询。

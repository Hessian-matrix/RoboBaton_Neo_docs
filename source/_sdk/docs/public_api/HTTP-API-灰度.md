#  未压缩灰度通道

2026-11-04。已部署驱动、HTTP 和网页，并接通浏览器动作采集、归档、求解入口及参数保存；实机采集和异常处理已验证，完整动作标定与精度仍待用户上机验证。详见[实测与操作步骤](../HTTP-API-灰度标定验证-2026-11-04.md)。

## 请求与生命周期

~~~http
GET /api/stream?channels=gray HTTP/1.1
~~~

每个连接只订阅一个通道；IMU 使用另一条 channels=imu 连接。无需灰度启动/停止/参数接口。第一位订阅者按需启动灰度采集，最后一位退出释放自身引用。订阅不会启动 VIO；VIO 启停与灰度订阅独立，现有采集所有者按相同格式/采样配置交接。当前固定 544×640、mono8、5 fps，无在线帧率修改。

HTTP 200 后采用 chunked 传输；先解 HTTP chunk，再解 RBH1。TCP read、HTTP chunk 与业务图像帧边界均不相等。每类最多4个连接，超过返回429 STREAM_LIMIT；整个Web服务仍受总连接数量限制。

未开始响应前，服务不可用为503 GRAY_UNAVAILABLE，内存不足为503 OUT_OF_MEMORY；首次最多等待8秒，未取得新鲜图像为503 GRAY_NOT_READY。已开始200响应后，源故障、3秒无新图、采集session/图像源epoch变化、序号或有效时间倒退均结束连接。客户端重新GET，重新读取元数据，不拼接半帧、不补历史；不能仅凭重连判断IMU与图像跨重启连续。

## 首条元数据

RBH1 channel=0，format=1，JSON：

~~~json
{
  "type": "metadata",
  "connection_id": "gray",
  "stream": {
    "source": {"type": "live"},
    "channels": [{"id": 5, "name": "gray", "format": 8}]
  },
  "config": {
    "encoding": "raw",
    "pixel_format": "mono8",
    "width": 544,
    "height": 640,
    "stride": 544,
    "fps": 5
  }
}
~~~

connection_id 为通道标签，不作为设备身份或采集epoch。尺寸/stride单位为像素/字节，fps为名义输出频率。过载允许跳帧；不能用5fps生成假时间戳。

## 每帧二进制

RBH1 channel=5，format=8，每个业务消息为：

| 字节偏移 | 长度 | 内容 |
|---|---|---|
| 0 | 4 | 小端uint32，UTF-8 JSON字节数N |
| 4 | N | 下列帧头JSON，1≤N≤252 |
| 4+N | 348160 | 544×640灰度像素，每像素一个uint8，逐行连续、无行填充 |

~~~json
{"header":{"seq":"1201","stamp":{"sec":123,"nanosec":456789000}}}
~~~

- seq：真实采集帧序号，uint64十进制字符串；JS使用BigInt。不是5Hz重新编号的计数，也不是RBH1传输序号。在稳定60Hz采集时相邻输出通常相差12，跳号不自动等于丢帧；时钟抖动、竞争、过载可能改变间隔。
- stamp：与IMU同域的CLOCK_MONOTONIC_RAW曝光中点，sec为秒，nanosec为0..999999999。纳秒总值不超过INT64_MAX。未可靠关联曝光时为null，标定消费者应排除该帧，不用网络接收时间补值。原始流不预加标定时间偏移。
- 像素就是VIO采集输入的Y8平面，未经JPEG/H26x压缩，也不是Sensor Bayer RAW。不叠加特征点、不旋转；与544×640标定网格一致。
- raw每帧独立，不需要PTS、random_access或编码器参数集。灰度图内存使用stride544；不泄露硬件行填充/物理地址。

RBH1仍为40字节小端头、版本1；单片最多65536字节，灰度业务消息最大348416字节。按同一传输序号和连续offset重组，完整消息后才交付像素。具体RBH1定义见[v3通用协议](HTTP-API.md)，具体schema见[OpenAPI](http-api.openapi.json)。format8只用于灰度，不改变v2 gray或TF录制的含义。

## 资源与数据优先级

本通道不把采集源或VPSS算法通道降成5Hz，源帧率由当前采集所有者决定；实测独立灰度时约60Hz，VIO接管后源序号间隔对应约30Hz。TF JPEG入队后，VIO消费者完成读取并归还租约时，才按采集时间选择5Hz图像并复制到一帧邮箱；未选中帧不进行外发像素复制。只有raw订阅时不启动灰度JPEG编码器。

邮箱采用trylock，竞争时跳过，不等待网络；仅保留最新帧。驱动媒体线程非阻塞广播，每客户端独立发送状态，前帧未发送完又有新帧时断开慢连接。HTTP发送线程nice=10，完整图像发送共享1秒期限，丢弃readout已超过500ms的图像。超时/断线释放本连接，不停止其他客户端、VIO或录制。此为有界资源策略，不能承诺负载下零丢帧或VIO零性能变化。

单客户端纯像素带宽：544×640×5=1,740,800 B/s，约13.93 Mbit/s，另有传输头开销。4客户端按网络外发量累计。

## 接收与测试

Python快速查看帧头（不会把348KB像素打印到控制台）：

~~~sh
python tools/http-api/client.py http://192.168.11.1 --channel gray --messages 10
~~~

Python Device.observe(['gray']) 返回frame.header、frame.config和frame.data；data长度固定348160。浏览器已支持 RoboBatonNeoBrowser.httpStream(['gray'])，onmessage事件返回frame及相同字段。观看仍使用彩色预览；公开标定页面从独立gray/imu连接采集，不修改TF文件结构。

本机回归命令：

~~~sh
bash tmp/test-public-gray.sh
~~~

脚本运行ASan/UBSan邮箱及真实采集协调器的主机桩生命周期测试、模拟驱动源→真实HTTP网关→Python/JS集成测试。WSL若没有Linux Node，可显式设置GRAY_TEST_NODE为可执行Node路径；它需能访问测试HTTP服务。测试覆盖5Hz、行填充去除/原像素一致、最新帧、锁竞争、VIO采集所有权交接/独立释放、无效时间、uint64/INT64边界、分片/截断/长度错误、epoch切换、慢客户端隔离、重连、连接上限和OpenAPI。

2026-11-04 本机验证结果：

| 检查 | 结果 |
|---|---|
| mailbox C测试，ASan/UBSan | 60Hz抖动输入10秒选50帧；像素/stride/有界邮箱/锁竞争检查通过 |
| lifecycle C测试，ASan/UBSan、无MPP主机桩 | 单独raw不启JPEG、VIO交接/释放、独立订阅、最终采集关闭通过；不等同硬件验收 |
| tmp/test-public-gray.py | 8项通过，包含JS真实HTTP接收及OpenAPI检查 |
| tmp/test-http.sh | VIO8项、IMU5项、Web5项、预览5项均通过 |
| tmp/test-public-color.sh | 7项通过（模拟三编码契约，非本轮硬件解码测试） |
| visualization/tests/test_build_web.py | 7项通过，公开/内部构建边界保留 |
| ARM Release交叉编译 | 公开driverd与browser-bridge通过；浏览器dist/manifest已重新生成 |

上述本机证据保存在tmp/public-gray/、tmp/http-color/和tmp/http/；后续实机证据在tmp/public-gray-board/。5fps与软件时间范围覆盖已验证；物理同步精度、真实全动作求解和长时间并发不在本轮验收结论内。

板端检查清单（实际完成项和范围见实测报告）：

1. 配套更新公开驱动、HTTP桥接和网页；停止VIO时订阅gray+imu，检查5fps、348160字节/帧、图像可见及IMU时域一致。
2. 保持gray连接，启动VIO再停止，检查里程计恢复/结束而gray仍继续，彩色预览不受停止动作影响。
3. 同时开启预览、IMU、gray及VIO，测60秒实际帧率、源序号和CPU；与无gray基线比较。
4. 用慢连接和正常连接同时订阅gray，验证慢连接退出后正常连接继续；拔插网络后重新GET，确认先收到元数据和完整新帧。
5. 取消所有订阅并停止VIO，确认采集释放。本轮不进行TF写卡、不宣称标定精度或长期并发验收。

## 公开网页标定流程

- 确认屏幕标定板尺寸后连接gray、imu及独立彩色preview，数据就绪后进入动作采集。只支持DS；兼容内部动作诊断的本地模式键仍为gray4，实际公开流为5fps。
- 网页创建本地采集会话，不调用v2标定任务接口，不自动启停VIO，不依赖实体按键。建议在正式标定前手动停止VIO。
- 保存原始曝光时间和IMU逐样本时间、源序号；不改成网络到达时间，不提前应用相机/IMU时间偏移。两个连接可先后到达，最多等待5张图，确保所存图像前后至少各100ms的IMU覆盖。
- 灰度在浏览器内无损保存为PNG，IMU为EuRoC CSV；capture.json记录传输来源，calibration-parameters.json保存准备本次采集时读取的v3参数快照，不创建第二份板端生效参数。硬件同步误差未知时syncErrorNs=null，不假报零。
- 断线、IMU缺号或超过15ms间隔、无效曝光、图像倒退或超过400ms间隔会中断，保留未完成数据供下载，禁止作为有效数据求解。不能自动重连续录。正常结束等待最后图像的IMU尾部收齐。
- 会话仅存页面内存，用户主动下载ZIP；有效ZIP可重新打开求解，未完成ZIP会被拒绝求解。单会话保守计数上限256MiB或15分钟，达到上限按中断保存；不等同浏览器总内存上限。页面关闭前应下载文件。
- 动作识别仍采用已确认的固定出厂参考内外参。当前设备参数仅作为会话参数快照和IMU噪声来源；彩色预览不参与标定计算。保存结果沿用POST /api/calibration/parameters，VIO运行中返回409，不代用户停算法。

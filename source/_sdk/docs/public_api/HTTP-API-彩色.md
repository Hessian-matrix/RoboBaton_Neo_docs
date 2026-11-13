# 全分辨率彩色接口

2026-11-03。

## 1. 配置

GET /api/color/config只返回一次JSON，不订阅图像。驱动未运行时会准备驱动服务，但不会因此启动彩色编码。

POST /api/color/config完整替换配置（非PATCH），Content-Type application/json，唯一Content-Length，正文1~256字节，不接受chunked、未知/重复字段。必须codec/fps和对应参数：

~~~json
{"codec":"mjpeg","fps":5,"quality":90}
~~~
~~~json
{"codec":"h264","fps":5,"bitrate_kbps":6000}
~~~

h265同视频结构。fps为1~60，quality为1~99，bitrate_kbps为64~20000；公开GOP固定约1秒。GET和POST成功返回实际配置，另加width=1080、height=1280、fps_max（只读）。例如：

~~~json
{"codec":"h264","width":1080,"height":1280,"fps":5,"bitrate_kbps":6000,"fps_max":60}
~~~

VIO运行时fps_max=5；启动时将高于上限的彩色配置降至5fps，停止VIO不自动恢复高帧率。fps是目标值，不是实测值；60是设置上限，不保证所有负载均能达到。1080×1280为有效图像尺寸，不是对齐存储宽度。配置仅在本次驱动运行期间有效，重启恢复驱动默认值。

POST 200表示配置已应用/保存到驱动，不表示下游已收到或解码首帧；无订阅时硬件编码器仍按需启动。相同配置不改变revision、不关闭连接。非法参数400；正文超时408；VIO限制/录制锁/并发修改冲突409；编码器应用失败500（尝试恢复旧配置）；控制服务或回复不完整503（不能推断执行结果，重新GET确认）。错误结构为 {"error":{"code":"..."}}。

## 2. 配置先于图像

GET /api/stream?channels=color。每连接单选一个通道，color最多4连接。Content-Type为application/vnd.robobaton.stream、Transfer-Encoding: chunked。第一条RBH1控制JSON：

~~~json
{"type":"metadata","connection_id":"color","stream":{"source":{"type":"live"},"channels":[{"id":4,"name":"color","format":7}]},"config":{"codec":"h264","width":1080,"height":1280,"fps":5,"bitrate_kbps":6000}}
~~~

connection_id仅用于已有流解析入口，不是设备/算法/轨迹身份。板端在订阅前后核对驱动配置revision，并核对帧内编码、宽高、fps、quality；取得可解码首帧后发送200及元数据，准备超时503。客户端用此连接配置初始化解码器，不用先前GET结果代替。

一个连接固定一套配置。有效配置变化、源/编码器重启、参数集变化结束旧连接；所有color订阅者重连，每次重新交付配置和参数集/IDR。MJPEG首帧为完整JPEG。网络重连不重启VIO或重置轨迹。

最后订阅退出后保留3秒重连宽限，随后停止编码；避免启动参数集变化导致反复重建编码器。停止VIO不停止仍有订阅的彩色、预览和IMU。网络外发线程nice=10；VIO、录制、外发优先级约定保持。本轮未开放TF API或测试写卡。

## 3. 彩色负载格式7

RBH1固定40字节头不变，channel=4、format=7。完整消息重组后：

| 偏移 | 长度 | 含义 |
|---:|---:|---|
| 0 | 4 | uint32小端：JSON字节数N，1~508 |
| 4 | N | UTF-8帧信息JSON |
| 4+N | total−4−N | 编码二进制，1~2097152字节 |

最大完整消息2097664字节；RBH1每片最多65536字节。HTTP chunk、TCP read不等于业务帧。禁止直接发送C内存结构或Base64。黄金样例由tmp/test-public-color.py生成，tmp/test-public-color.cjs验证C/Python/JS同义。

~~~json
{"header":{"seq":"124","stamp":{"sec":146,"nanosec":543970875}},"pts_us":"146550000","random_access":true}
~~~

| 字段 | 类型与含义 |
|---|---|
| header.seq | 真实编码输出uint64序号的十进制字符串；不是sensor原始帧编号，也不是RBH1连接内序号。源重启可重新开始 |
| header.stamp | CLOCK_MONOTONIC_RAW曝光中点，秒+纳秒；同步标志无效时null，不填接收时间或PTS |
| stamp.sec/nanosec | 非负整数，nanosec为0~999999999，组合不超过INT64_MAX纳秒 |
| pts_us | VENC呈现时间微秒的uint64字符串；与曝光时钟不同，MJPEG为null |
| random_access | JPEG=true；视频只在实际IDR且已获得对应参数集时true。H265普通I/CRA不作为本版独立恢复点 |

MJPEG一消息一JPEG；H264/H265一消息一完整AnnexB访问单元。板端在每个标记true的视频消息中加入当前SPS/PPS或VPS/SPS/PPS（允许原AU已有参数集），保证该消息携带参数集及IDR。普通视频帧为false。

当前协议仅MJPEG的pts_us为null；H264/H265必须提供真实PTS，网页/Python视频接收器检查该约束。浏览器先用BigInt相减建立相对时间，再转Number。保留硬件normal-P配置，不以源码配置代替所有场景无重排序验收；真实解码结果见实测报告。

首帧等待最多10秒、后续源读取最多8秒；每条完整业务消息的全部网络分片共用1秒发送期限，失败结束连接，不发送半帧后跳到下一帧。当前持续慢客户端直接断开（JPEG也如此），不积压历史。视频源序号缺口结束连接，从新IDR恢复。

## 4. 网页和普通主控

网页“彩色图像输出→设置与接口”支持取流前/取流中配置；真正改变时自动重连，同配置保持。码率按钮/方向键100 kbit/s，手动1 kbit/s；关闭对话框释放本页彩色订阅。

JPEG使用浏览器图片解码，H264沿用MSE支持普通HTTP；H265使用WebCodecs并从真实SPS生成codec配置。浏览器/系统不支持H265或普通HTTP缺少WebCodecs时明确提示，仍可配置和由普通主控接收，不偷偷改编码。未接入相机几何参数，不依据当前标定补值或宣称可用于几何投影。

~~~sh
python tools/http-api/client.py http://192.168.11.1 --color-config
python tools/http-api/client.py http://192.168.11.1 --color-config '{"codec":"h264","fps":5,"bitrate_kbps":6000}'
python tools/http-api/client.py http://192.168.11.1 --channel color --messages 30
~~~

OpenAPI见同目录http-api.openapi.json；实测范围见[彩色验证](../HTTP-API-彩色验证-2026-11-03.md)。

系统重启并发约束（2026-11-09）：本模块的业务变更/配置写入在系统重启已受理或重启状态存储异常时返回409 REBOOT_BUSY；先查询[系统状态](HTTP-API-系统.md)，不自动重复变更。普通状态查询保持可用。

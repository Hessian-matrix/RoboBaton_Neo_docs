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

h265同视频结构。fps档位为60、30、20、15、12、10、6、5、4、3、2、1，MJPEG quality 为 1～90（默认 80），与 VIO 开关无关，bitrate_kbps为64~20000；公开GOP固定约1秒。GET和POST成功返回实际配置，另加width=1080、height=1280、fps_max（只读）。例如：

~~~json
{"codec":"h264","width":1080,"height":1280,"fps":5,"bitrate_kbps":6000,"fps_max":60,"supported_fps":[60,30,20,15,12,10,6,5,4,3,2,1],"available_fps":[60,30,20,15,12,10,6,5,4,3,2,1]}
~~~

VIO 运行时三种编码的 HTTP 推流均为 fps_max=30，这是 VIO 的总体上限，全分辨率彩色在 VIO 关闭时最高 60 fps，开启时最高 30 fps。VIO 开启并叠加深度、原灰、JPEG 灰度或含图像的 TF 录制时，全彩最高 5 fps；原灰 30 与全彩始终互斥。独立预览不限制可选档位。全彩不超过 5 fps 时可与预览并行；超过 5 fps 时，首张完整全彩帧发出后结束已有独立预览连接，全彩占用期间新预览返回 409 IMAGE_CONFLICT。仅查询、改档或开流失败不会切断已有预览。例如：已有 preview 时 POST 彩色 30 fps，预览继续；接着 GET /api/stream?channels=color，首帧发出后结束 preview。此时重新 GET preview 返回 409；关闭全彩释放订阅后可重新 GET preview。各工况以 available_fps 为准；启动 VIO 不改已选档位；已有超过上述组合上限的彩色推流，或高于 5 fps 的 TF 彩色录制，均拒绝启动 VIO。仅预设高档不阻止 VIO 启动。supported_fps 是全部档位，available_fps 是当前可新订阅的档位；HTTP 彩色已被占用或与原灰 30 冲突时返回 []。TF 正在录制彩色且 HTTP 彩色空闲时，仅返回录制锁定的那一档，例如 [5]；释放录制后按当前工况重新计算。supported_fps 不随占用改变，fps_max 不能代替 available_fps。fps是目标值，不是实测值；60是设置上限，不保证所有负载均能达到。1080×1280为有效图像尺寸，不是对齐存储宽度。配置仅在本次驱动运行期间有效，重启恢复驱动默认值。

例如 TF 正在以 5 fps 录彩色时，其他客户端可按相同配置订阅一次；POST 改为 30 或仅修改 JPEG 质量均返回 HTTP 409：`{"error":{"code":"CONFIG_CONFLICT"}}`。同档可订阅并不表示可以修改编码参数。

同一网页先开启全分辨率彩色流，再显示普通实时预览时，使用本页已经解码的画面，不另开 preview 请求。深度和标定仍使用独立预览。

网页“设置与接口”显示所有支持的帧率档位，当前不可选的档位置灰。若保存值高于当前上限，摘要仍显示保存值；仅选择可用档位并应用才修改配置。

POST 200表示配置已应用/保存到驱动，不表示下游已收到或解码首帧；无订阅时硬件编码器仍按需启动。相同配置不改变revision、不关闭连接。例如 {"codec":"mjpeg","fps":30,"quality":90} 是合法配置；quality=91 返回 HTTP 400、错误码 INVALID_CONFIG，保留原配置。非法参数400；正文超时408；VIO限制/录制锁/并发修改冲突409；编码器应用失败500（尝试恢复旧配置）；控制服务或回复不完整503（不能推断执行结果，重新GET确认）。错误结构为 {"error":{"code":"..."}}。

## 2. 配置先于图像

GET /api/stream?channels=color。每连接单选一个通道，color最多1个客户端，重复订阅返回409 IMAGE_CONFLICT。Content-Type为application/vnd.robobaton.stream、Transfer-Encoding: chunked。第一条RBH1控制JSON：

~~~json
{"type":"metadata","connection_id":"color","stream":{"source":{"type":"live"},"channels":[{"id":4,"name":"color","format":7}]},"config":{"codec":"h264","width":1080,"height":1280,"fps":5,"bitrate_kbps":6000}}
~~~

connection_id仅用于已有流解析入口，不是设备/算法/轨迹身份。板端在订阅前后核对驱动配置revision，并核对帧内编码、宽高、fps、quality；取得可解码首帧后发送200及元数据，准备超时503。客户端用此连接配置初始化解码器，不用先前GET结果代替。

一个连接固定一套配置。彩图订阅或TF彩色录制期间改变配置返回409 CONFIG_CONFLICT。源/编码器重启、参数集变化会结束旧连接；客户端重连，每次重新交付配置和参数集/IDR。MJPEG首帧为完整JPEG。网络重连不重启VIO或重置轨迹。

最后订阅退出后保留3秒重连宽限，随后停止编码；避免启动参数集变化导致反复重建编码器。停止VIO不停止仍有订阅的彩色、预览和IMU。当前 TF 录制接口与配置锁见[TF 录制说明](HTTP-API-TF录制.md)。

## 3. 彩色负载格式7

RBH1固定40字节头不变，channel=4、format=7。完整消息重组后：

| 偏移 | 长度 | 含义 |
|---:|---:|---|
| 0 | 4 | uint32小端：JSON字节数N，1~508 |
| 4 | N | UTF-8帧信息JSON |
| 4+N | total−4−N | 编码二进制，1~2097152字节 |


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

首帧最多等待 10 秒，后续源读取最多等待 8 秒；完整业务消息的发送期限为 1 秒，失败结束连接。MJPEG 可跳号，H.264/H.265 源序号缺口会结束连接，重新订阅后从有效 IDR 恢复。

H.264/H.265 顺序传输；过载或源序号缺口可结束连接。重新 GET 订阅后等待参数集和 IDR，不提供同连接解码器重置事件，也不保证端到端延迟。

## 4. 网页和普通主控

网页“彩色图像输出→设置与接口”在取流前配置，已有订阅时保持该配置。码率按钮/方向键100 kbit/s，手动1 kbit/s；关闭对话框释放本页彩色订阅。

JPEG使用浏览器图片解码，H264沿用MSE支持普通HTTP；H265使用WebCodecs并从真实SPS生成codec配置。浏览器/系统不支持H265或普通HTTP缺少WebCodecs时明确提示，仍可配置和由普通主控接收，不偷偷改编码。未接入相机几何参数，不依据当前标定补值或宣称可用于几何投影。

~~~sh
python tools/http-api/client.py http://192.168.11.1 --color-config
python tools/http-api/client.py http://192.168.11.1 --color-config '{"codec":"h264","fps":5,"bitrate_kbps":6000}'
python tools/http-api/client.py http://192.168.11.1 --channel color --messages 30
~~~

OpenAPI见同目录http-api.openapi.json；实测范围见彩色验证（详见产品说明）。

系统重启并发约束（2026-11-09）：本模块的业务变更/配置写入在系统重启已受理或重启状态存储异常时返回409 REBOOT_BUSY；先查询[系统状态](HTTP-API-系统.md)，不自动重复变更。普通状态查询保持可用。



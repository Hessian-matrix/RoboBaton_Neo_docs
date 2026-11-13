# SDK 网页文档更新验证

日期：2026-11-13。范围：独立 RoboBaton_Neo_docs 网页与文档；没有推送 GitHub、发布线上或更新设备。

## 更新内容

- 保持用户文档五部分组织，在第四部分新增 SDK 总览/下载、Python SDK、C++ SDK、STM32 串口 SDK，保留原 Python 单文件快速验证。
- ROS / ROS 2 从自行实现桥接说明改为 SDK 已有示例包的安装、构建、运行、话题、参数及完整源码。提供里程计、灰度压缩图像与各自 source_header；不虚构原始 Image、CameraInfo、IMU 或 TF 发布。C++/Python 同步提供图像保存示例。
- 示例源码由 literalinclude 直接读取 SDK 白名单快照，不手抄另一份实现。明确 HTTP IMU 原点与 UART 安装补偿参考点、四元数排列、单调时间与 ROS 主机发布时间、假设协方差、null 和断流规则。
- 下载 SDK ZIP、SHA-256、逐文件来源清单。56 个 SDK/API 文件，不包含 VIO、驱动、内核或板内服务实现。HEAD 与工作区修改状态分开记录，不能当作已发布固件。
- 程序接入页与快速开始增加 SDK 入口，保留原交互步骤和 AI / 自己运行方式。窄屏覆盖站点既有 nav 首链接隐藏样式，SDK 下载入口在手机可见。
- 现有 Python ZIP 与网页单文件从统一 SDK 源码生成。为独立下载包，仅在不含应用仓库时跳过旧路径和单文件生成器两项测试；应用仓库原测试仍完整执行。
- 构建流水线加入 check_sdk.py，检查快照、下载、逐文件哈希、代码语法与旧 Python 包一致性。

## 检查结果

| 检查 | 结果 |
| --- | --- |
| Sphinx 7.1.2 / Python 3.11 严格构建，-W --keep-going -E -a | 通过，零警告；sphinx-build.txt |
| 产品站白名单、相对依赖、缓存版本和文档同步 | 通过；66 个原产品资源 |
| 文档链接与契约 | 32 个 HTML 页面、2745 个本地链接、203 个 OpenAPI 本地引用、4 个原基础示例通过 |
| SDK 快照与下载 | 56 个 SDK/API 文件哈希一致；ZIP 隔离、源码引用、原 Python ZIP 与单文件一致性通过 |
| SDK ZIP 独立解压构建 | 3/3 CTest 组通过；Python 22 项中 20 项执行通过、2 项应用仓库专属测试明确跳过；download-tests.txt |
| 应用仓库 SDK 回归 | 4/4 CTest 组通过，含生产编码器 HAL 桩和完整 22 项 Python 测试 |
| 浏览器检查 | 6 篇 SDK 文档 × 1440/390/320px × 浅色/深色 = 36 个视图通过；无页面横向溢出或脚本错误；核对 C++/Python 图像示例及 ROS 图像话题、参数在各视图可见 |
| 页面导航与下载 | 保持五部分结构；SDK 六个入口可用；浏览器实际下载 ZIP 的 SHA-256 匹配；STM32 搜索有结果 |
| 既有教程资源 | 24 个发布课程、78 组视频/封面/字幕/回退正文检查通过 |
| 差异检查 | git -c core.whitespace=cr-at-eol diff --check 通过 |

浏览器结果与截图保存在本目录 browser-report.json、sdk-*.png。测试只访问本机静态站点，未连接设备。

## 验收边界

没有真实 ROS 构建/运行、DDS、STM32 HAL/IRQ 接线、飞控融合或设备精度验收。文档未将主机测试扩写成硬件验证。
SDK _sdk 来源树不进入发布目录；只发布明确提供的 ZIP 下载。未修改设备接口、CORS、板端程序、IMU 或系统职责。
本次保留两个仓库已存在的其他未提交修改，没有提交或推送它们。

## 重跑

~~~sh
python3 tools/sync_sdk.py /path/to/cv-610-pub
python3 tools/check_sdk.py
python3 -m sphinx -E -a -b html -W --keep-going source tmp/docs
python3 tools/build_site.py
python3 tools/check_site.py
python3 tools/check_docs.py tmp/site/docs
python3 tools/check_web_tutorials.py tmp/site/docs
node tools/check_sdk_browser.cjs
~~~

浏览器脚本通过 PLAYWRIGHT_MODULE 与 CHROME_PATH 选择已有环境。同步需可访问应用仓库；普通 Pages 构建仅检查已保存快照，不依赖应用仓库存在。

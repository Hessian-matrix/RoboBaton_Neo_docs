# RoboBaton Neo 产品网站与文档

## 网页使用：逐项短视频

第三部分先用标注截图说明页面分区，再展示 8 个功能页、每页 3 段主要操作视频，时长约 9–27 秒。目录和文字维护在 source/_static/web-tutorials/catalog.json；publishedLessons 明确页面发布顺序，保留的基础片段不单独展开。Sphinx 的 web-tutorials 指令生成可搜索的正文；compact 模式把限制说明集中在页尾。视频始终标注演示，不接触设备，也不代表实机验收。

视频、封面和字幕随 Sphinx 静态资源发布，preload=none，进入视口后静音自动播放；同时只播放一段，离开视口或切到后台暂停。媒体 URL 带内容 SHA256 的短版本号，更新素材后不复用旧缓存。桌面与手机保留原生播放、进度及全屏。录制夹具、设备页面源码和测试脚本均不进入部署目录。

重录使用 tools/record_web_tutorials.cjs --record；NEO_APP_ROOT 指向应用仓库，PLAYWRIGHT_MODULE 和 CHROME_PATH 选择本机浏览器工具，PLAYWRIGHT_BROWSERS_PATH 指向 tmp/web-tutorials/browsers。首次用 Playwright CLI 的 install ffmpeg 安装匹配编码工具。FFMPEG_PATH 可指定支持 VP8 解码与 libvpx 编码的完整工具；默认使用该临时目录中的 ffmpeg-1011。TUTORIAL_ONLY 以逗号选择重录片段；不带 --record 只检查操作，不联系板卡。--encode-existing 只重新编码 tmp 中已录好的素材。临时素材在 tmp/web-tutorials，检查报告在 release/web-tutorials。

当前 24 段发布视频统一使用 node tools/record_reviewed_tutorials.cjs 重新采集公开页面的 2 倍分辨率画面，再运行 python tools/render_reviewed_tutorials.py。采集保留操作前后状态；渲染依据 DOM 取景平滑放大、移动，字幕置于顶部，底部留给播放器控件。IMU 分别特写读数、加速度曲线、角速度曲线。TUTORIAL_ONLY 在采集时选择基础来源 ID，在渲染时选择发布视频 ID；完整重录时不设置该变量。临时素材在 tmp/reviewed-tutorials；逐段前后对照图及校验报告在 release/video-review，标注为模拟演示，不代表实机验收。旧 focus_web_tutorials.py 和 IMU 专用渲染器仅供历史素材维护，不要用低清基础视频覆盖当前发布视频。

本地预览使用 python tools/serve_docs_preview.py --port 8873。它只监听 127.0.0.1，并支持媒体 Range 请求；不要用不支持 Range 的 python -m http.server 验证步骤跳转，否则浏览器可能把视频跳回开头。默认目录为 tmp/docs-review，HTML 不缓存。

构建后运行 python tools/check_web_tutorials.py tmp/site/docs 检查全部 78 组素材、媒体版本号、正文步骤与发布隔离；python tools/check_reviewed_tutorials.py 核对 24 段视频的高清来源、操作前后、取景完整性和媒体哈希；node tools/check_focused_pages.cjs 验证八页、48 种明暗及响应式布局、24 段解码跳转和实际 IMU 播放画面。还需人工检查 release/video-review 下每段对照图。录像复用当前公开源码候选，不代表实机验收。修改指令扩展后使用 sphinx -E -a 重建。

产品网站：https://hessian-matrix.github.io/RoboBaton_Neo_docs/

文档中心：https://hessian-matrix.github.io/RoboBaton_Neo_docs/docs/

## 页面来源和维护

`site/` 保存用户在本地 8765 端口确认的完整产品页面，含产品模型、轨迹演示、性能数据、接口展示和快速开始。直接修改这里的 HTML/CSS/JS；不再用简化模板替代原页面。导航中的“文档”跳转同站点 `/docs/`，旧 `docs.html` 地址保留跳转。

`site-manifest.json` 是公开资源白名单。`tools/build_site.py` 将列出的文件原样复制至干净的 `tmp/site`。不发布原型编辑脚本、参考资料、截图、测试依赖或设备应用源码。Three.js 为 MIT 许可，其许可证随站点发布。产品数据中的性能说明保留历史基准范围，不表示当前固件重新实测。

Sphinx 的产品介绍从同份产品 HTML 提取文字、规格、表格和来源说明。文档中的第一次使用与逐页网页使用改由短视频目录生成；产品站的连接引导仍在原 quick-start.html 维护。Sphinx 使用文档主题，不复制交互画布或设备检测功能。

首页 CSS/JS 引用带 SHA-256 前 12 位缓存版本；修改资源后运行 `python3 tools/version_assets.py`，检查会拒绝过期哈希。

## 用户文档维护

### SDK 接入文档

外部系统统一以应用仓库 SDK/ 为基准。运行 `python3 tools/sync_sdk.py /path/to/cv-610-pub` 同步显式白名单客户端源码、测试及公开 API 文档；source/_sdk 仅用于 literalinclude 和本地来源核验，Sphinx 不复制源码树。公开下载只通过 SDK ZIP 提供；source/_downloads/sdk-provenance.json 记录逐文件哈希、应用 HEAD 与工作区修改状态，不能将未提交快照标成已发布固件。

本次同步同时从 SDK 更新原 Python ZIP 和单文件示例，不发布 tools/http-api 旧兼容入口。SDK 白名单不含 VIO/驱动/系统实现；HAL 生产编码器联测只在应用仓库可选构建，独立 ZIP 不捆绑设备实现。SDK 页按 Python、C++、ROS 1、ROS 2、STM32 组织，示例源码直接引用快照，运行范围和实机验收分开。修改后运行 `python3 tools/check_sdk.py`、Sphinx 严格构建和组装站点链接检查。

文档顶部提供产品介绍、快速开始、文档中心及搜索入口，各正文页和搜索页共享。`source/_templates/layout.html` 定义导航，`source/_static/custom.css` 统一产品站绿色强调、无衬线字体及明暗/手机布局；保留 Sphinx 目录和搜索。链接校验在组装后的 `tmp/site/docs` 上运行，以包含返回产品站的相对路径。

详细章节覆盖安装连接、定位、标定、两种录制、图像/深度、安装与飞控、设备设置、更新及排障；版本与验证边界见 `source/scope.rst`。操作说明依据公开版源码和当前接口，不照搬历史内部版说明。

`python3 tools/sync_api.py /path/to/cv-610-pub` 从应用公开契约同步 OpenAPI、完整方法索引和来源 SHA-256。同步要求源契约无未提交修改；接口变更仍先在应用仓库维护，再更新文档快照。`python3 tools/check_docs.py` 核对本地引用、示例语法与生成页面链接，不连接或操作设备。

## 构建命令

```bash
python3.11 -m venv tmp/venv
tmp/venv/bin/pip install -r source/requirements.txt
tmp/venv/bin/python -m sphinx -b html -W --keep-going source tmp/docs
python3 tools/build_site.py
python3 tools/check_site.py
python3 -m http.server 8000 --directory tmp/site
```

推送 `master` 后，GitHub Actions 构建 Sphinx 文档、校验接口和链接，将产品站与文档作为同一产物发布到 GitHub Pages。文档保留 Sphinx Book Theme、侧栏目录和本地搜索。无需 Read the Docs 后台，旧 readthedocs.io 地址不会由此更新。

后台前提：GitHub Settings → Pages → Source 为 GitHub Actions。`tmp/site/docs/` 为文档发布目录；构建排除 .doctrees、_sources、.buildinfo 和 source map，保留下载契约、主题资源和搜索索引。遗留 Read the Docs 配置仅供历史兼容，不参与当前发布。

快速开始第一步提供免驱说明和安装文档链接，详细 CDC-NCM 步骤参考 Milk-V USB Net 设置。第二步支持纯 IP 或 IP:端口（1–65535，不填默认 80），点击连接后在 iframe 中打开设备网页，支持展开预览；修改 IP 会关闭旧预览。HTTPS 内嵌 HTTP 或设备嵌入策略可能导致空白，保留新窗口入口。不自动连接设备，不将 iframe 加载事件当作连接成功。

## 模型遮挡回归

首页与轨迹演示共用 `site/model-depth.js`，使用逐像素深度测试绘制模型；浏览器无法使用 WebGL 时回退到软件深度缓冲。外壳、镜头和接口按几何深度遮挡。

构建完成后运行 `node tools/check_model.cjs`；需要 Playwright Core（可通过 `PLAYWRIGHT_MODULE` 指定安装位置），`CHROME_PATH` 指定浏览器。测试覆盖相交面的遮挡与绘制顺序、WebGL/软件两条路径、裸机/带壳旋转、俯仰、手机宽度和轨迹进度操作。截图默认保存到 `release/model-depth/`；`MODEL_TEST_OUTPUT` 可更改结果目录，`SITE_URL` 可指定线上站点。

入门页面采用三个平级步骤标签：连接电脑、连接设备、初始化与轨迹。第二、三步共用同一 iframe，切换只改变可见性，不重新加载或清空设备操作状态。开发接入独立分区，Python/Node.js 位姿及图像接收见 source/api-examples.rst，串口 MAVLink 2 接收见 source/serial-pose.rst。示例复用当前公开客户端，不捆绑设备或内部功能源码。

## 交互式使用教程

Python 网页执行使用 python-runtime.js 和 python-worker.js，按需加载 jsDelivr 上的 Pyodide 0.27.7。Worker 仅执行页面展示的固定 Python 示例；浏览器适配器处理 Web Serial / RBH1 接收，Python 处理解码数据和 print 输出。数据不上传 CDN。加载超时或取消销毁 Worker；接收停止沿用页面生命周期。运行 check_browser_receiver.cjs 会下载并使用真实 Pyodide，测试设备仍为模拟器，需要能访问 CDN。

公开教程按 quick-start.html → integration.html → robot-mounting.html → calibration-guide.html 串联。
接入页默认提供 JavaScript 网页运行：点击后通过 Web Serial 接收真实 MAVLink 位姿，或通过 HTTP 接收 RBH1 位姿/灰度 JPEG；显示真实结果、错误与停止状态。串口需电脑 Chrome/Edge 及 HTTPS/localhost；当前固件没有 HTTP CORS，产品站跨域读取可能被阻止。另保留 Python/Node.js 下载示例。
网页接收器只读，15 秒无数据超时、60 秒自动结束；运行 node tools/check_browser_receiver.cjs 验证协议解析、串口生命周期、HTTP/JPEG、空值/错误和手机布局。测试使用模拟设备，不代表真实板卡验收；结果存放 release/browser-receiver/。
代码复用与固件配套的公开客户端，依赖在页面中明确说明；integration-examples.json 是公开接收示例模板，不携带设备源码。
安装页支持裸机/带壳尺寸、平台与位置示意、FLU/FRD 偏移换算；它不是机械加工图，不保存设备参数。
标定页引导用户判断需求、确认尺寸、理解采集动作和保存验证；示意图不能作为实际标定板。
运行 node tools/check_integration.cjs 检查输入校验、下载及响应式布局；运行 node tools/check_lessons.cjs 检查后续课程交互。

四章统一在 quick-start.html 纵向滚动阅读。后续章节使用同源内嵌页面，隐藏重复导航并以 ResizeObserver/postMessage 同步高度；父页校验来源与窗口身份，避免章节内滚动。切换章内步骤及跨章导航保留各章状态；独立地址继续可访问。

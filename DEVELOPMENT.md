# RoboBaton Neo 产品网站与文档

产品网站：https://hessian-matrix.github.io/RoboBaton_Neo_docs/

文档中心：https://hessian-matrix.github.io/RoboBaton_Neo_docs/docs/

## 页面来源和维护

`site/` 保存用户在本地 8765 端口确认的完整产品页面，含产品模型、轨迹演示、性能数据、接口展示和快速开始。直接修改这里的 HTML/CSS/JS；不再用简化模板替代原页面。导航中的“文档”跳转同站点 `/docs/`，旧 `docs.html` 地址保留跳转。

`site-manifest.json` 是公开资源白名单。`tools/build_site.py` 将列出的文件原样复制至干净的 `tmp/site`。不发布原型编辑脚本、参考资料、截图、测试依赖或设备应用源码。Three.js 为 MIT 许可，其许可证随站点发布。产品数据中的性能说明保留历史基准范围，不表示当前固件重新实测。

Sphinx 的产品介绍和快速开始从相同 HTML 提取文字、规格、表格和来源说明。修改产品页面并推送后，两边对应内容一起更新；Sphinx 使用文档主题，不复制交互画布或设备检测功能。详细文档仍在 `source/*.rst` 维护。

首页 CSS/JS 引用带 SHA-256 前 12 位缓存版本；修改资源后运行 `python3 tools/version_assets.py`，检查会拒绝过期哈希。

## 用户文档维护

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

公开教程按 quick-start.html → integration.html → robot-mounting.html → calibration-guide.html 串联。
接入页默认提供 JavaScript 网页运行：点击后通过 Web Serial 接收真实 MAVLink 位姿，或通过 HTTP 接收 RBH1 位姿/灰度 JPEG；显示真实结果、错误与停止状态。串口需电脑 Chrome/Edge 及 HTTPS/localhost；当前固件没有 HTTP CORS，产品站跨域读取可能被阻止。另保留 Python/Node.js 下载示例。
网页接收器只读，15 秒无数据超时、60 秒自动结束；运行 node tools/check_browser_receiver.cjs 验证协议解析、串口生命周期、HTTP/JPEG、空值/错误和手机布局。测试使用模拟设备，不代表真实板卡验收；结果存放 release/browser-receiver/。
代码复用与固件配套的公开客户端，依赖在页面中明确说明；integration-examples.json 是公开接收示例模板，不携带设备源码。
安装页支持裸机/带壳尺寸、平台与位置示意、FLU/FRD 偏移换算；它不是机械加工图，不保存设备参数。
标定页引导用户判断需求、确认尺寸、理解采集动作和保存验证；示意图不能作为实际标定板。
运行 node tools/check_integration.cjs 检查输入校验、下载及响应式布局；运行 node tools/check_lessons.cjs 检查后续课程交互。

四章统一在 quick-start.html 纵向滚动阅读。后续章节使用同源内嵌页面，隐藏重复导航并以 ResizeObserver/postMessage 同步高度；父页校验来源与窗口身份，避免章节内滚动。切换章内步骤及跨章导航保留各章状态；独立地址继续可访问。

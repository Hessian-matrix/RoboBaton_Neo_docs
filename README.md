# RoboBaton Neo 产品网站与文档

产品网站：https://hessian-matrix.github.io/RoboBaton_Neo_docs/

文档中心：https://neo-docs.readthedocs.io/zh-cn/latest/

## 页面来源和维护

`site/` 保存用户在本地 8765 端口确认的完整产品页面，含产品模型、轨迹演示、性能数据、接口展示和快速开始。直接修改这里的 HTML/CSS/JS；不再用简化模板替代原页面。导航中的“文档”跳转 Read the Docs，旧 `docs.html` 地址保留跳转。

`site-manifest.json` 是公开资源白名单。`tools/build_site.py` 将列出的文件原样复制至干净的 `tmp/site`。不发布原型编辑脚本、参考资料、截图、测试依赖或设备应用源码。Three.js 为 MIT 许可，其许可证随站点发布。产品数据中的性能说明保留历史基准范围，不表示当前固件重新实测。

Sphinx 的产品介绍和快速开始从相同 HTML 提取文字、规格、表格和来源说明。修改产品页面并推送后，两边对应内容一起更新；Sphinx 使用文档主题，不复制交互画布或设备检测功能。详细文档仍在 `source/*.rst` 维护。

首页 CSS/JS 引用带 SHA-256 前 12 位缓存版本；修改资源后运行 `python3 tools/version_assets.py`，检查会拒绝过期哈希。

## 构建与发布

## 用户文档维护

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

推送 `master` 触发 GitHub Actions 构建检查并发布 Pages，同时 Read the Docs 的 GitHub 集成构建文档。两者独立运行，以各自构建结果与线上内容为准。

后台前提：GitHub Settings → Pages → Source 为 GitHub Actions；Read the Docs 的 `neo-docs` 绑定本仓库、`master` 和 `latest`，中文路径为 `zh-cn`，webhook 已启用。

快速开始中的网络检测只有用户点击才发送一次 GET，不改变设备。HTTPS 站点访问 HTTP 设备可能受浏览器本地网络权限或混合内容策略限制，检测失败不代表设备离线；始终提供直接打开设备页面的链接。

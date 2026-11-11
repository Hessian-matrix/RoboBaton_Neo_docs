# RoboBaton Neo 产品网站与文档

同一仓库发布两个独立站点：

- GitHub Pages：产品介绍、快速开始，预期地址 https://hessian-matrix.github.io/RoboBaton_Neo_docs/ 。
- Read the Docs：Sphinx 使用文档，https://neo-docs.readthedocs.io/zh-cn/latest/ 。

产品站的“文档”链接跳转 Read the Docs。两者不打包或连接设备操作界面。

## 修改内容

产品介绍和快速开始的共用内容在 `source/product.json`，两个站点均读取它，避免重复维护。
产品网站生成器为 `tools/build_site.py`，样式为 `site/style.css`。
详细文档在 `source/*.rst`，通过 `source/index.rst` 的 toctree 接入。
仅修改详细文档不会改变产品介绍的内容；两个站点仍会各自重新发布。

## 一次性后台配置

1. GitHub 仓库 Settings → Pages → Source 选择 **GitHub Actions**。
2. Read the Docs 项目 `neo-docs` 绑定本仓库，默认分支设为 `master`，启用 `latest`。
3. 确认 GitHub 与 Read the Docs 的集成/webhook 已启用，中文版本对应 `zh-cn`。
4. 在 Read the Docs 后台核实上述公开地址及语言配置。

提交并推送到 `master` 后，GitHub Actions 检查 Sphinx 并发布产品网站；
Read the Docs 通过自己的 GitHub 集成独立构建文档。两边是独立异步任务，不保证同时完成。
查看 GitHub Actions 的部署结果和 Read the Docs Builds 的提交号，确认都是本次提交后再验收。
仅有 `.readthedocs.yaml` 不能代替后台绑定；GitHub Pages 构建成功也不代表 Read the Docs 已更新。
本地准备发布配置不等于线上发布完成。

## 本地预览

```bash
python3.11 -m venv tmp/venv
tmp/venv/bin/pip install -r source/requirements.txt
tmp/venv/bin/python -m sphinx -b html -W --keep-going source tmp/docs
python3 tools/build_site.py
python3 -m http.server 8000 --directory tmp/site
```

访问 http://127.0.0.1:8000/ 查看产品站；将服务目录改为 `tmp/docs` 可查看文档。
既有 `make deps`、`make html`、`make serve` 仍用于 Sphinx 文档。

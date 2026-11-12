# Neo 电脑连接工具

为线上产品站读取现有设备的 HTTP 流提供本机转发。无需修改设备配置、固件或网页服务，不使用公网代理。网页中的 JavaScript 解码公开 RBH1，Python 仍在浏览器内运行。

## 使用

1. Windows x64 下载产品站的 `NeoConnect-Windows-x64.exe`，双击并保持窗口打开。程序免安装，已包含运行环境；未签名。
2. 在同一台连接 Neo USB 网络的电脑上，用 Chrome / Edge 打开产品站“接入你的程序”。
3. 选择 USB、填写设备的实际地址（当前测试设备为 `192.168.46.1`，默认 80 端口），网页连接方式选“电脑连接工具”。不要沿用已停用的 `:46002`。
4. 选择 Python，点击“加载 Python”，再“连接并运行”；允许浏览器请求的本地网络访问权限。JavaScript 可直接连接。
5. 关闭工具窗口即停止。工具不注册开机启动、不安装服务，也不保存设备数据。

macOS / Linux 尚未提供免安装包，可使用 Python 3 运行 `python3 neo_connect.py --headless`；仅依赖标准库。网页串口可独立使用，不经过此工具。

## 边界

- 仅监听 `127.0.0.1:18765`，局域网其他电脑无法连接。
- 浏览器来源精确限制为 `https://hessian-matrix.github.io`，不接受任意网站；GitHub Pages 同源下的所有路径共享此来源。检查 Host、防止 DNS rebinding；无凭据、无 Cookie。
- 只允许 HTTP、RFC1918 IPv4 地址、`GET /api/stream?channels=odometry|gray_jpeg`；不跟随重定向，不转发客户端头，不使用系统 HTTP 代理。
- 不开放设备启动、停止、配置、更新或通用代理。每次最多两个并发流、每条最多 65 秒，网页每次接收 60 秒。
- `GET /health` 返回工具标识与版本；`OPTIONS` 支持 CORS / Private Network Access 预检。浏览器本地网络权限仍由用户授予，不关闭浏览器安全限制。
- 位姿订阅不会启动 VIO。图像只使用设备已公开的订阅机制，断开释放自身订阅。

错误：`DEVICE_UNREACHABLE` 检查 USB 网络/地址；`DEVICE_HTTP_ERROR` 携带设备状态码；`DEVICE_PROTOCOL_MISMATCH` 表示不是所需数据流；`CONNECTOR_BUSY` 表示两个连接已占满。

## 构建与测试

在 Windows Python 虚拟环境安装 `pip install -r connector/build-requirements.txt`（PyInstaller 6.16.0）：

```powershell
python -m PyInstaller --noconfirm --clean --onefile --windowed --name NeoConnect-Windows-x64 --distpath site --workpath tmp/connector-pyinstaller --specpath tmp/connector-pyinstaller connector/neo_connect.py
python tools/package_connector.py
python connector/test_connector.py
```

Windows 包当前使用 Python 3.9.11、PyInstaller 6.16.0，版本与 SHA256 随发布文件记录。单元回归覆盖地址校验、来源/Host、重复头、预检、只读路径、真实 HTTP 分块转发、错误及连接数上限。实机结果另存 release，不将测试源或模拟器打包进程序。

接入电脑
========

一根 USB 数据线即可为 Neo 供电，并通过电脑浏览器打开设备网页。

.. raw:: html

   <div class='computer-connection' role='img' aria-label='连接示意：Neo Type-C 接口通过 USB 数据线连接电脑，电脑浏览器打开设备地址'>
     <div class='computer-device'>
       <img src='_static/manual/neo-enclosed-photo.webp' alt='Neo 设备' width='200' height='149'>
       <strong>Neo · Type-C</strong>
     </div>
     <div class='computer-cable'><span>USB 数据线</span><i aria-hidden='true'></i><small>数据 + 供电</small></div>
     <div class='computer-screen'>
       <svg viewBox='0 0 220 145' aria-hidden='true' focusable='false'>
         <rect x='22' y='12' width='176' height='112' rx='7' fill='none' stroke='currentColor' stroke-width='2'/>
         <path d='M22 35h176M4 130h212l-9 8H13z' fill='none' stroke='currentColor' stroke-width='2' stroke-linejoin='round'/>
         <circle cx='34' cy='24' r='2' fill='currentColor'/><circle cx='43' cy='24' r='2' fill='currentColor'/>
         <text x='110' y='71' text-anchor='middle' fill='currentColor' font-size='16' font-family='sans-serif'>Neo</text>
         <text x='110' y='95' text-anchor='middle' fill='currentColor' font-size='13' font-family='sans-serif'>192.168.11.1</text>
       </svg>
       <strong>电脑 · 浏览器</strong>
     </div>
   </div>

连接步骤
--------

.. container:: computer-step

   .. rubric:: 01 · 插上数据线

   将 Neo 的 Type-C 接口连接到电脑 USB 口。使用支持数据传输的线材，不是仅充电线。
   这一步无需串口模块，也无需安装 Neo 桌面软件。

.. container:: computer-step

   .. rubric:: 02 · 确认识别为网卡

   等待系统出现新的 **USB 网络适配器**，将其 IPv4 设置为 **自动获取地址（DHCP）**。
   已正常识别网卡，就直接进入下一步，不必重复安装驱动。

.. raw:: html

   <span id='computer-windows-usb-driver'></span>
   <details class='computer-help computer-driver'><summary>Windows 10：没有识别网卡？展开驱动安装步骤</summary>

仅在设备管理器出现 **CDC NCM 黄色感叹号** 时按下面步骤处理；已识别网卡的电脑不需要操作。
Windows 版本和驱动可用性不同，以下方法以列表中确实提供对应驱动为前提。

.. container:: computer-driver-stages

   .. rubric:: A · 找到设备

   1. 右键开始菜单，打开“设备管理器”。
   2. 插拔 Neo 数据线，确认对应设备为“CDC NCM”，右键选择“更新驱动程序”。

   .. rubric:: B · 选择驱动

   3. 选择“浏览我的电脑以查找驱动程序”。
   4. 选择“让我从计算机上的可用驱动程序列表中选取”。
   5. 选择“网络适配器”→ 厂商“Microsoft”→ 型号“UsbNcm Host Device”。
   6. 核对选中的是 Neo 的 CDC-NCM 设备及上述驱动后，再继续安装。

   .. rubric:: C · 确认结果

   7. 在“网络适配器”下确认“UsbNcm Host Device”正常显示，没有黄色感叹号。
   8. 将该网卡的 IPv4 设置为自动获取地址，继续下一步打开网页。

**没有这个驱动选项？** 先通过 Windows Update 检查系统与驱动更新；仍没有时，不要强行指定其他驱动，
需核对该 Windows 版本可用的 CDC-NCM 支持或改用已兼容的电脑。
未出现 CDC NCM 设备时，先更换数据线与 USB 口，不从安装驱动开始排查。

.. container:: product-footnote

   \* 步骤参考 `Milk-V USB Net 设置 <https://milkv.io/zh/docs/duo/getting-started/setup>`_，
   可查看其中的设备管理器截图；参考页使用 Duo 的地址，Neo 默认地址仍为 192.168.11.1。
   `Microsoft USB 类驱动说明 <https://learn.microsoft.com/zh-cn/windows-hardware/drivers/usbcon/supported-usb-classes>`_
   列出了系统内置 NCM 驱动的适用 Windows 版本，不应假定所有 Windows 10 均已自带。

.. raw:: html

   </details>
   <details class='computer-help'><summary>macOS / Linux：在哪里查看 USB 网卡？</summary>

* **macOS**：打开“系统设置 → 网络”，查看连接 Neo 后新增的 USB 网络接口。
* **Linux**：打开系统网络设置，或使用 `ip link` 查看新接口；系统需支持并加载 `cdc_ncm`。

识别后将 IPv4 设置为自动获取地址。系统未出现网卡时，先检查线材、USB 端口与对应系统驱动支持。

.. raw:: html

   </details>

.. container:: computer-step

   .. rubric:: 03 · 打开设备网页

   在浏览器 **地址栏** 输入 `http://192.168.11.1/`，不要输入到搜索框。
   如果修改过设备网络地址，使用修改后的实际地址。

.. container:: computer-success

   **连接成功的判断**：能打开 Neo 设备网页，并看到图像持续更新。
   只显示网卡或网页已打开，还不能代替实时数据检查；查看位姿前还需启动并初始化 VIO。

USB 网卡显示“无互联网”不影响访问 Neo，电脑可继续通过 Wi-Fi 或以太网上网。

遇到问题再展开
--------------

.. raw:: html

   <details class='computer-help'><summary>网页打不开、没有画面或地址冲突</summary>

.. list-table:: 按现象检查
   :header-rows: 1
   :widths: 30 70

   * - 现象
     - 先检查什么
   * - 没有新增 USB 网卡
     - 换一条支持数据的线，直连电脑 USB 口；Windows 出现 CDC NCM 黄色感叹号时，再看上方驱动步骤。
   * - 有网卡，网页打不开
     - 确认在对应 USB 网卡上自动获取 IPv4，使用设备实际地址；不要把“无互联网”当作连接失败。
   * - 同时有其他网络
     - 若另一网卡也使用 192.168.11.0/24，核对路由，避免访问错误设备；网络修改见 :doc:`device-settings`。
   * - 网页打开，但画面不更新
     - 检查设备连接状态、图像开关与浏览器解码支持，见 :doc:`imaging`。

默认配套设备为 `192.168.11.1/24`，DHCP 地址池为 `192.168.11.100–150`。
这条 USB 网络不提供互联网网关或 DNS。可用 `ping 192.168.11.1` 辅助检查连通性，但最终仍以设备网页和图像更新为准。

.. raw:: html

   </details>

.. container:: doc-next

   已连接成功？进入 :doc:`web-guide`；想用程序读取数据，查看 :doc:`api-examples`。

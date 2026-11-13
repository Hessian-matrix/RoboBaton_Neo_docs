Python 快速验证
===============

.. container:: doc-lead

   用一个完整 Python 文件读取设备位置和灰度图像。自己运行，或把代码与任务一起交给 AI。

.. container:: doc-facts

   **环境** Python 3.8+　　**依赖** 仅标准库，无需 pip　　**设备操作** 只读，不修改配置

运行前准备
----------

本页保留无需安装 SDK 的单文件快速验证，协议代码由统一 SDK 源码生成。
正式接入自己的程序请使用 :doc:`sdk-python`；其他环境及完整下载见 :doc:`sdk`。
本页 2026-11-12 的设备历史实测不代表新增 C++、ROS 或 STM32 已实机验收。

1. 将 Neo 通过 USB 数据线连接到这台电脑，确认能够打开设备网页。
2. 在设备网页启动 VIO 并完成初始化。获取位置需要有效定位；订阅接口不会自动启动算法。
3. 确认电脑已有 Python 3.8+。Windows 常用 ``py -3``，macOS / Linux 常用 ``python3``。

默认设备地址为 ``http://192.168.11.1``。修改过网络配置时请填写实际地址。
示例从你的电脑访问设备，普通云端聊天执行环境无法访问你的局域网。

选择运行方式
------------

.. raw:: html

   <div class="docs-code-workbench" data-example-workbench>
   <section class="docs-code-pane" aria-label="完整Python示例"><div class="docs-code-toolbar"><strong>neo_quick_test.py</strong><div><button type="button" data-copy-code disabled>复制代码</button><a href="_static/neo_quick_test.py" download>下载 .py</a></div></div><pre tabindex="0"><code data-example-code>正在加载完整示例…</code></pre><p data-code-status role="status">完整单文件，不需要额外客户端文件。</p></section>
   <section class="docs-run-pane" aria-label="运行示例"><label for="example-address">设备地址</label><input id="example-address" value="http://192.168.11.1" spellcheck="false"><label for="example-channel">要获取的数据</label><select id="example-channel"><option value="both">位置和图像</option><option value="odometry">仅位置</option><option value="gray_jpeg">仅灰度图像</option></select><div class="docs-methods" role="group" aria-label="运行方式"><button type="button" data-mode="manual" aria-pressed="true">自己运行</button><button type="button" data-mode="ai" aria-pressed="false">交给 AI</button></div><div class="docs-mode-slot"><div data-panel="manual"><p>下载或复制左侧代码，保存为 <strong>neo_quick_test.py</strong>，在文件所在目录运行：</p><pre data-example-command></pre><button type="button" data-copy-command>复制命令</button><p class="docs-muted">根据本机解释器，将 python 替换为 py -3 或 python3。</p></div><div data-panel="ai" hidden><p>复制任务要求、当前连接参数和完整代码，粘贴给能操作这台电脑的 AI 助手。</p><button type="button" class="docs-primary" data-copy-ai disabled>复制提示词和完整代码</button><p class="docs-muted">AI 应实际运行并检查结果。没有 Python 时，先由你决定是否安装。</p></div></div><p data-run-status role="status"></p></section></div>

.. _api-python:

运行后会得到什么
----------------

默认读取 **3 条有效位姿和 3 张灰度图像**。程序会在 ``neo-results`` 下创建新的时间戳目录，
不会覆盖上一次结果。两路按顺序订阅，不是同步配对帧。

.. list-table::
   :header-rows: 1
   :widths: 28 44 28

   * - 文件
     - 内容
     - 怎样检查
   * - ``report.json``
     - 状态、数量与失败原因
     - 所选流的 ok 均为 true
   * - ``poses.jsonl``
     - 真实位姿、序号与时间戳
     - 位置有效，序号递增
   * - ``image-001.jpg`` 等
     - 544 × 640 灰度 JPEG
     - 打开图片，确认能解码

仅选择位置时不会生成图片，仅选择图像时不会生成位姿文件。
退出码 **0** 表示所选数据都收齐，**1** 表示至少一路失败，具体原因保留在报告中。

.. code-block:: text
   :caption: 输出目录示意，不是你的设备实时结果

   neo-results/
     <本次运行时间>/
       report.json
       poses.jsonl
       image-001.jpg
       image-002.jpg
       image-003.jpg

正确理解结果
------------

位置单位为米，参考点为 IMU 原点，姿态使用 ``x/y/z/w`` 四元数字段。
空位姿与心跳不会计入成功数量。序号保留为字符串。
接收成功只说明接口读取成功；若报告仍有 ``CALIBRATION_REQUIRED`` 等警告，
应继续检查标定，不能据此判定定位精度已通过验收。

没有得到结果时
--------------

.. list-table::
   :header-rows: 1
   :widths: 32 68

   * - 现象
     - 下一步
   * - 找不到 Python
     - 检查 py -3 / python3；未安装时由用户决定是否安装
   * - 连接被拒绝或超时
     - 核对 USB 网络和设备地址，先确认能打开设备原网页
   * - 没有有效位姿
     - 确认 VIO 启动并完成初始化；见 :doc:`positioning`
   * - HTTP 429
     - 关闭多余订阅，再有限重试
   * - 只成功获得一种数据
     - 查看报告中的每路结果，分别排查
   * - AI 无法访问设备
     - 确认具有本机终端权限，而不是只运行在云端沙箱

每路默认等待 15 秒，阻塞读取最多可能额外等待 10 秒。停止测试不会停止板端 VIO。
程序仅 GET 查询状态和订阅位姿、灰度图像，不刷固件、不修改板端设置。

验证范围
--------

2026-11-12，已在正式设备 ``192.168.11.1`` 上验证 Python 单文件：
从网页剪贴板提取代码并运行，收齐 3 条位姿和 3 张可解码的 544 × 640 图像。
这是该设备与该次版本的接口验证，不代表所有历史固件与环境都已覆盖。

当前交付 Python 本机示例。C++ / Rust 本机示例尚未完成验证，不作为可用下载提供。
本页复制和下载不读取设备接口，执行发生在你的电脑上。

.. container:: doc-next

   下一步：:doc:`api-guide`，了解查询、命令与数据流。使用串口？查看 :doc:`serial-pose`。

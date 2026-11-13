Neo 使用文档
============

.. container:: doc-lead

   了解 Neo，安装并使用设备，再将定位与图像接入你的应用。

.. raw:: html

   <form class="docs-search" action="search.html" method="get" role="search"><label for="docs-search-input">搜索文档</label><div><input id="docs-search-input" name="q" placeholder="性能参数、TF 卡、网页操作、ROS…" required><button type="submit">搜索</button></div></form>

.. raw:: html

   <div class="docs-chapters"><section class="docs-chapter" aria-labelledby="chapter-1"><div class="chapter-heading"><span class="chapter-number">01</span><div><h2 id="chapter-1">Neo 性能与参数</h2><p>先确认尺寸、重量、相机、惯性数据与定位输出的能力和限制。</p></div></div><nav class="chapter-links" aria-label="Neo 性能与参数"><a href="product.html"><span>性能参数与能力范围</span><span aria-hidden="true">↗</span></a></nav></section><section class="docs-chapter" aria-labelledby="chapter-2"><div class="chapter-heading"><span class="chapter-number">02</span><div><h2 id="chapter-2">设备安装与连接</h2><p>完成机械安装与供电，连接电脑、手机或串口，并准备 TF 卡。</p></div></div><nav class="chapter-links" aria-label="设备安装与连接"><a href="installation.html"><span>设备安装与供电</span><span aria-hidden="true">↗</span></a><a href="connect-computer.html"><span>接入电脑</span><span aria-hidden="true">↗</span></a><a href="connect-phone.html"><span>接入手机</span><span aria-hidden="true">↗</span></a><a href="connect-serial.html"><span>串口接线</span><span aria-hidden="true">↗</span></a><a href="install-tf.html"><span>插入与准备 TF 卡</span><span aria-hidden="true">↗</span></a></nav></section><section class="docs-chapter" aria-labelledby="chapter-3"><div class="chapter-heading"><span class="chapter-number">03</span><div><h2 id="chapter-3">Neo 网页的使用</h2><p>按设备网页实际页面，了解每个功能在哪里、怎么操作、怎样确认结果。</p></div></div><nav class="chapter-links" aria-label="Neo 网页的使用"><a href="web-guide.html"><span>网页总览</span><span aria-hidden="true">↗</span></a><a href="positioning.html"><span>实时视图</span><span aria-hidden="true">↗</span></a><a href="imaging.html"><span>图像、IMU 与深度</span><span aria-hidden="true">↗</span></a><a href="mount-settings.html"><span>安装补偿页面</span><span aria-hidden="true">↗</span></a><a href="flight-page.html"><span>飞控接入页面</span><span aria-hidden="true">↗</span></a><a href="recording.html"><span>数据管理页面</span><span aria-hidden="true">↗</span></a><a href="calibration.html"><span>标定页面</span><span aria-hidden="true">↗</span></a><a href="device-settings.html"><span>网络、按键与开机设置</span><span aria-hidden="true">↗</span></a><a href="maintenance.html"><span>在线更新与重启</span><span aria-hidden="true">↗</span></a></nav></section><section class="docs-chapter" aria-labelledby="chapter-4"><div class="chapter-heading"><span class="chapter-number">04</span><div><h2 id="chapter-4">程序与外部系统接入</h2><p>把数据接入自己的程序、飞控、ROS 或 ROS 2，核对协议与坐标约定。</p></div></div><nav class="chapter-links" aria-label="程序与外部系统接入"><a href="api-examples.html"><span>Python 快速验证</span><span aria-hidden="true">↗</span></a><a href="api-guide.html"><span>HTTP 接入基础</span><span aria-hidden="true">↗</span></a><a href="serial-pose.html"><span>串口协议接入</span><span aria-hidden="true">↗</span></a><a href="mounting-flight-controller.html"><span>接入飞控</span><span aria-hidden="true">↗</span></a><a href="ros.html"><span>接入 ROS</span><span aria-hidden="true">↗</span></a><a href="ros2.html"><span>接入 ROS 2</span><span aria-hidden="true">↗</span></a><a href="api-reference.html"><span>API 参考</span><span aria-hidden="true">↗</span></a></nav></section><section class="docs-chapter" aria-labelledby="chapter-5"><div class="chapter-heading"><span class="chapter-number">05</span><div><h2 id="chapter-5">故障与版本</h2><p>按现象排查问题，并确认设备版本与文档的适用范围。</p></div></div><nav class="chapter-links" aria-label="故障与版本"><a href="troubleshooting.html"><span>故障排查</span><span aria-hidden="true">↗</span></a><a href="scope.html"><span>版本与兼容性</span><span aria-hidden="true">↗</span></a></nav></section></div>

.. container:: doc-next

   第一次使用，从 :doc:`product` 开始。已经连接设备，可直接进入 :doc:`web-guide`。

文档与设备网页
--------------

这里用于查阅说明。实际控制设备请打开设备网页，默认地址为 ``http://192.168.11.1/``，
修改过网络配置时以实际地址为准。产品网站模型和示意动画不代表你的设备实时数据。

.. toctree::
   :hidden:
   :maxdepth: 1
   :caption: 01 · Neo 性能与参数

   性能参数与能力范围 <product>

.. toctree::
   :hidden:
   :maxdepth: 1
   :caption: 02 · 设备安装与连接

   设备安装与供电 <installation>
   接入电脑 <connect-computer>
   接入手机 <connect-phone>
   串口接线 <connect-serial>
   插入与准备 TF 卡 <install-tf>

.. toctree::
   :hidden:
   :maxdepth: 1
   :caption: 03 · Neo 网页的使用

   网页总览 <web-guide>
   实时视图 <positioning>
   图像、IMU 与深度 <imaging>
   安装补偿页面 <mount-settings>
   飞控接入页面 <flight-page>
   数据管理页面 <recording>
   标定页面 <calibration>
   网络、按键与开机设置 <device-settings>
   在线更新与重启 <maintenance>

.. toctree::
   :hidden:
   :maxdepth: 1
   :caption: 04 · 程序与外部系统接入

   Python 快速验证 <api-examples>
   HTTP 接入基础 <api-guide>
   串口协议接入 <serial-pose>
   接入飞控 <mounting-flight-controller>
   接入 ROS <ros>
   接入 ROS 2 <ros2>
   API 参考 <api-reference>

.. toctree::
   :hidden:
   :maxdepth: 1
   :caption: 05 · 故障与版本

   故障排查 <troubleshooting>
   版本与兼容性 <scope>

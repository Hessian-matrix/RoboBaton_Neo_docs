RoboBaton Neo 使用文档
======================

RoboBaton Neo 将相机与 IMU 数据融合为视觉惯性定位结果。通过设备网页，
可以查看实时图像和轨迹、采集数据、标定设备、配置安装关系与飞控接入。

第一次使用，建议按“安装与连接 → 快速开始 → 实时定位”的顺序阅读。
开发自己的主控程序，请从“HTTP API 接入”开始。

.. list-table:: 三个入口，各做什么
   :header-rows: 1
   :widths: 22 38 40

   * - 入口
     - 地址
     - 用途
   * - 产品网站
     - `产品介绍 <https://hessian-matrix.github.io/RoboBaton_Neo_docs/>`_
     - 产品外观、规格、演示与快速入门
   * - 文档中心
     - 本站
     - 阅读使用流程、限制、接口及故障处理
   * - 设备操作页面
     - 默认 http://192.168.11.1/
     - 连接真实设备后进行定位、标定、录制和配置

产品网站的三维模型和运动动画是示意，不是你的设备实时数据。设备地址修改后，
请使用修改后的地址；能打开产品网站不代表已经连上 Neo。

.. toctree::
   :maxdepth: 2
   :caption: 认识设备与开始使用

   product
   installation
   quick-start
   positioning

.. toctree::
   :maxdepth: 2
   :caption: 配置与日常操作

   calibration
   recording
   imaging
   mounting-flight-controller
   device-settings
   maintenance

.. toctree::
   :maxdepth: 2
   :caption: 开发与问题处理

   api-guide
   api-reference
   troubleshooting
   scope

本说明依据当前公开版应用源码和接口契约整理，适用范围见 :doc:`scope`。
具体硬件接线以对应硬件版本资料为准；历史性能测试不表示所有固件、场景和组合负载均已验收。

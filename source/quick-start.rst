快速开始
========

.. product-content:: steps

运行前的参数确认
----------------

“出厂已标定”适用于保有匹配出厂参数的设备。若设备显示
``CALIBRATION_REQUIRED`` 或参数来源为 ``default``，不能按已标定处理，
请先阅读 :doc:`calibration`。已有参数也应确认匹配当前设备与镜头。

第一次运行后可继续阅读 :doc:`positioning` 判断定位状态；
需要记录数据时参阅 :doc:`recording`，连接飞控前参阅 :doc:`mounting-flight-controller`。

连接或运行异常
--------------

无法访问设备时，先检查供电、USB 网络和电脑自动获取 IP 的设置，再核对设备当前地址。
初始化或跟踪异常时，检查页面状态与错误码、图像质量、标定参数和安装配置。

产品网站的 `快速开始 <https://hessian-matrix.github.io/RoboBaton_Neo_docs/quick-start.html>`_
提供电脑系统选择和手动连接检测；检测只在点击后发送 GET，不修改设备。
HTTPS 网站检测 HTTP 设备可能受浏览器安全策略或本地网络权限限制，失败不代表设备离线。
请使用“打开设备页面”在设备自身的网页上执行实时操作；本站文档不执行网络检测。

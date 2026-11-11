接口契约与完整索引
==================

本页根据应用公开版 OpenAPI 自动列举，逐字段类型、枚举、必填项、请求体和响应以契约为准。
入门示例及流协议见 :doc:`api-guide`，各功能操作步骤见对应用户章节。

:download:`下载 OpenAPI 3.1 契约 <_downloads/http-api.openapi.json>`

:download:`下载来源与 SHA-256 <_downloads/api-provenance.json>`

下载后可在支持 OpenAPI 3.1 的编辑器中查看并生成客户端。生成器通常只能处理普通 HTTP 结构，
二进制 RBH1/RBF2 流仍须实现相应解析器；不能把订阅响应作为单个 JSON。

应用来源提交：``c2fad336b539f01994c9bf0f8076a0d2a84bf20e``。

SHA-256：``a6f7d8cb4b2e487a857b8d68ea48225ff7370086b7d79cbfffe5500218c7ac2b``。

当前操作清单
------------

.. list-table:: HTTP 方法、路径和操作标识
   :header-rows: 1
   :widths: 12 48 40

   * - 方法
     - 路径
     - 操作标识
   * - POST
     - ``/api/vio``
     - ``acceptVioCommand``
   * - GET
     - ``/api/vio``
     - ``getVioStatus``
   * - GET
     - ``/api/stream``
     - ``observeStream``
   * - GET
     - ``/api/color/config``
     - ``getColorConfig``
   * - POST
     - ``/api/color/config``
     - ``setColorConfig``
   * - GET
     - ``/api/recording``
     - ``getRecording``
   * - POST
     - ``/api/recording``
     - ``acceptRecording``
   * - GET
     - ``/api/monitor``
     - ``getMonitor``
   * - GET
     - ``/api/datasets``
     - ``listDatasets``
   * - GET
     - ``/api/datasets/{id}``
     - ``getDataset``
   * - DELETE
     - ``/api/datasets/{id}``
     - ``deleteDataset``
   * - GET
     - ``/api/datasets/{id}/archive``
     - ``downloadDataset``
   * - GET
     - ``/api/recording/check``
     - ``getRecordingPreflight``
   * - POST
     - ``/api/recording/check``
     - ``acceptRecordingPreflight``
   * - GET
     - ``/api/mount/config``
     - ``getMountConfig``
   * - POST
     - ``/api/mount/config``
     - ``saveMountConfig``
   * - GET
     - ``/api/calibration/parameters``
     - ``getCalibrationParameters``
   * - POST
     - ``/api/calibration/parameters``
     - ``saveCalibrationParameters``
   * - GET
     - ``/api/buttons/config``
     - ``getButtonsConfig``
   * - POST
     - ``/api/buttons/config``
     - ``saveButtonsConfig``
   * - GET
     - ``/api/serial/status``
     - ``getSerialStatus``
   * - GET
     - ``/api/mavlink/status``
     - ``getMavlinkStatus``
   * - GET
     - ``/api/mavlink/parameters``
     - ``getMavlinkParameters``
   * - POST
     - ``/api/mavlink/parameters``
     - ``setMavlinkParameters``
   * - POST
     - ``/api/mavlink``
     - ``manageMavlink``
   * - GET
     - ``/api/update``
     - ``getUpdate``
   * - POST
     - ``/api/update``
     - ``acceptUpdate``
   * - POST
     - ``/api/update/package``
     - ``uploadUpdatePackage``
   * - GET
     - ``/api/boot/config``
     - ``get /boot/config``
   * - POST
     - ``/api/boot/config``
     - ``post /boot/config``
   * - GET
     - ``/api/depth/config``
     - ``getDepthConfig``
   * - GET
     - ``/api/system/status``
     - ``getSystemStatus``
   * - POST
     - ``/api/system/reboot``
     - ``acceptSystemReboot``
   * - GET
     - ``/api/network/config``
     - ``readNetworkConfig``
   * - POST
     - ``/api/network/config``
     - ``changeNetworkConfig``

共 35 个方法/路径操作，统计直接来自本页契约，不沿用历史报告中的数量。

使用契约前
----------

* 先确认设备版本；本契约快照不会自动读取当前连接设备的能力。
* GET 返回的只读字段不能未经筛选直接作为 POST 请求。
* 命令受理、实际完成、持久保存和下次启动生效分别处理。
* 示例用于说明结构，不能将示例标定数值当作设备真实参数。
* 实时流开始后错误可能通过关闭连接体现，不能只检查最初的 HTTP 200。

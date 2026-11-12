串口接线
========

串口接线前提
------------

Neo 与飞控使用 3.3 V LVTTL 串口：Neo TX 接飞控 RX，Neo RX 接飞控 TX，GND 共地。
不能直接接 RS-232。产品手册 V1.1 对硬件 v1.5 给出的 6pin VIN 范围为 3.3–5 V；
接口中的同步信号为 1.8 V，不能当作 3.3 V 串口脚使用。

实体插头方向与针号必须按对应硬件手册核对，不从网页模型推断。
飞控不同端口的供电脚电压不同，接入前确认电源规格；具体配置流程见 :doc:`mounting-flight-controller`。


连接电脑需要 USB 转 TTL
-----------------------

普通电脑 USB 口不能直接接设备 TX/RX；需要支持 3.3 V 逻辑电平的 USB 转 TTL 模块。
模块的 USB 端接电脑。Neo TX 接模块 RX，Neo RX 接模块 TX，两端 GND 相连。
设备仍需要合适的供电，不能把三根信号线当作完整供电方案。

选择独立供电或 USB 供电时按对应硬件手册核对，不能把未知模块的 VCC 电压直接接到 Neo。
模块驱动是否需要安装取决于模块与操作系统。

.. container:: doc-next

   接线完成后：读取数据见 :doc:`serial-pose`；接飞控见 :doc:`mounting-flight-controller`。

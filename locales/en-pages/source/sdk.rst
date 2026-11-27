Unified SDK integration
=========================

.. container:: doc-lead

   External program access is harmonized to  SDK is the baseline. Select the example of the operating environment to stop copying the protocol from the old tool directory.

.. container:: doc-facts

   **Source** Application repository  SDK/　　**Connect** USB Network  HTTP or  UART　　**Default Behaviour** Read-only subscriptions

Download & Select
-------------------

:download:`Download Full  SDK <_downloads/robobaton-neo-sdk.zip>` ·
:download:`Download  SHA-256 <_downloads/robobaton-neo-sdk.sha256>` ·
:download:`View source lists and document-by-file verification values <_downloads/sdk-provenance.json>`

Unpressure and enter content  SDK/ The directory executes the following command. Download package from this local  SDK Source Snapshot.
Each inventory shall record its application. ]  HEAD Discrepancies with the workspace do not impersonate the outstanding source code as a published solid.
It’s an application client  SDK，Board level with kernel, system mirror and cross-tool chain  SDK Different.

:doc:`sdk-cpp` · C++17
   HTTP Position and Greyscale  JPEG Receive/Save, rely on  libcurl and  json-c。

:doc:`sdk-python` · Python 3.8+
   HTTP Positions, positions. IMU & Greyscale  JPEG Save examples; the client also supports other open channels.
   First experience available. :doc:`api-examples`，No need to install  SDK。

:doc:`ros` · ROS 1
   Independence  catkin Example package, release mileage, compress images and original source time.

:doc:`ros2` · ROS 2
   Independence  ament_python Example package, release mileage, compress images and original source time.

:doc:`sdk-stm32` · STM32
   C99 MAVLink 2 Decoder with  Cube HAL Accept fit.

Before connecting
-------------------

1. USB Use the network on a computer  HTTP，I don’t think so.  USB Serial. The default address is  http://192.168.11.1。
2. Start on device web page  VIO . Subscriptions do not activate algorithms, they are disconnected and do not stop algorithms.
3. UART Receiving check first.  3.3 V TTL、TX/RX、Co-location, independent power supply and both parties’ Porter rates.
4. Read the example only without changing configuration, without obscuring, or automatically re-unlocking the track. The new session is explicitly opened when the stream is cut or the device restarts.

Coordinates, Time and Empty Values
------------------------------------

HTTP Position reference point fixed to  IMU Place of origin. The world is the right hand. Z Up, the initial course is not north;
Attitude is...  world_from_imu，Name  x/y/z/w，Line speed and angle speed.  IMU Is expression.
Take it.  frame Change name  base_link It’s not going to get a robot center or something.  FLU Coordinates.

UART Data has been installed for reimbursement and origin/Course aligned. Four dollars.  w/x/y/z，
Press  frame_id / child_frame_id It’s not an explanation. It’s not a direct consideration.  HTTP Original  IMU Bits.

HTTP Time from device  CLOCK_MONOTONIC_RAW，No, it’s not.  UTC。Retention of serial number  uint64 Decimal string,
No float-point conversion is permitted. null The position, speed or time indicates that it is not available and cannot be replaced by zero.
ROS Example: Use host release time to send another original device  header；The clock sync is completed when a precise integration is required.

Directory and Validation Border
---------------------------------

.. code-block:: text

   SDK/
     cpp/       C++ Client & Position/Image Example
     python/    robobaton_sdk Pack and position./IMU/Image Example
     ros/       ROS 1 and  ROS 2 Example Package
     stm32/     C99 Parser and  HAL Fit
     tests/     Host protocol and fit return

Python The only source code for the protocol is in  SDK/python/robobaton_sdk；Application repository  tools/http-api The same-name module is only compatible with the old path.
SDK Do not enter the device ’ s web package and do not add equipment interfaces or internal functionality.
Download the package with the public  API Document for field search, web reference :doc:`api-reference`。

Download packages to compile and run host returns independently; old warehouse client needs to be applied/The two tests of the single file generator will be clearly bypassed.
The production encoder connection is also only available when the application warehouse exists and does not count these skipping items as download acceptance approvals.

2026-11-13 Host Validation Overwrite Four Groups  SDK Back, back. 22 Item  Python Integrated testing, C++ HTTP、
Production  MAVLink Encoder to  HAL Linking and protocol resolution of stakes  ASan/UBSan（No leak inspection.
It doesn’t mean you’ve completed the real equipment. ROS Build/DDS、STM32 Connect/IRQ Or fly control integration inspection.

.. container:: doc-next

   Continue by Language :doc:`sdk-python` or :doc:`sdk-cpp`；See you on embedded access. :doc:`sdk-stm32`。




:doc:`recording-tools`

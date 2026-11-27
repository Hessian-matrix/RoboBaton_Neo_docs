Firmware updates and restart
==============================

Firmware downloads
--------------------

The latest version is  V2.0.0（2026-11-26）。

* `Download latest firmware <https://hessian-matrix.github.io/RoboBaton_Neo_docs/firmware/latest/RoboBaton-Neo.viofw>`_
* `Download  SHA256 Checksum file <https://hessian-matrix.github.io/RoboBaton_Neo_docs/firmware/latest/RoboBaton-Neo.viofw.sha256>`_
* `V2.0.0 Release details <https://github.com/Hessian-matrix/RoboBaton_Neo_docs/releases/tag/v2.0.0>`_ · `All releases <https://github.com/Hessian-matrix/RoboBaton_Neo_docs/releases>`_

The firmware and checksum links always point to the latest release. For a specific version, open the release history.

V2.0.0
--------

* Added VIO control via MAVLink serial commands and an RC switch. Serial commands can start, stop or restart VIO. Select an RC channel in the web interface to start or stop VIO with the switch.

* With VIO on, image output supports up to 30 fps. Raw grayscale adds a 30 fps setting alongside 5 fps; full-resolution color alone increases from 5 fps to 30 fps.With VIO on, depth, raw grayscale, grayscale JPEG or TF image recording limits color to 5 fps. Independent preview does not lower selectable color rates; color above 5 fps closes independent preview once frames are produced.

* Fixed remounting after an abnormal TF card removal. Cards can be mounted again after passing a filesystem check. The web interface adds Recheck and Safely eject actions.

* Fixed premature termination of web recordings and removed the 256 MiB total size limit per recording.

* Added official firmware update notifications. The web interface can check for a new version and, after user confirmation, download the package and upload it to the device.

* Fixed recording not responding to the physical button.

If an older web interface has no update-check option, download the package and upload it manually. Screenshots and videos below show an earlier version; use the controls shown on your current device.

After downloading, select ``RoboBaton-Neo.viofw``，on the device’s update page. Upload, wait for validation, install, then restart when prompted.
Confirm the version shown by the device and read the release notes. Keep power stable throughout installation.

.. figure:: _static/manual/page-updateTab-annotated.png
   :alt: Version and Status, Select Installer Package and Upload and Verify
   :target: _static/manual/page-updateTab-annotated.png
   :figclass: web-page-overview

   Select the image to view the controls

.. web-tutorials:: update
   :title: Feature walkthrough
   :no-intro:
   :compact:

.. container:: doc-next

   Back :doc:`web-guide` Find other operations; interface field and program access :doc:`api-reference`。

.. container:: product-footnote

   \* Screenshots and videos use demonstration data.

Update status and version identity
----------------------------------

GET /api/update no longer returns installed. running and gateway_running describe the actual
running programs, while package describes the candidate; never substitute one for the other.
After installation but before restart, the running identity still describes the old version.
A newly started version does not establish that operation has completed.
The page checks firmware/latest.json and downloads/uploads a package after user confirmation.
Installation and restart remain explicit actions. Reminders can be deferred for 24 hours per device/version.

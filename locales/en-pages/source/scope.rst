Scope and version notes
=========================

Document Based
----------------

See the latest hard copy download and the historical version. :doc:`maintenance`。V2.0.0（2026-11-26）。
This interface documentation targets the formal v2.0.0 tag, application commit
``79881b5992f8378ea3eb9d5e9578dc8baf733e6f`` （2026-11-26）。
The SDK is a separate host source snapshot dated 2026-11-27, including the new recording parser; it is not presented as source from the firmware tag.
See :doc:`sdk` for provenance and file checksums and :doc:`api-reference` for the contract.

These descriptions do not automatically prove that the same construction has been installed on the device.
The network addresses or updated layouts vary, pre-operational checking of the running version, using a gateway set, web pages and applications.

Open functional boundaries
----------------------------

Current public version available  VIO、Image/IMU、Relative Depth, equipment acquisition markers, TF/Browser Recording,
Data management, installation compensation, keys, network, start-up strategy, flight access and local upgrade package updates.
Added official firmware update notifications. The web interface can check for a new version and, after user confirmation, download the package and upload it to the device.

Internal Playback, Offline Mark Package/EuRoC Import, develop solver portals, run log pages and double-version construction
is not a current publicly available product. The publicly available package download is not the same as providing an algorithm playback.

How to understand the authentication description
--------------------------------------------------

* Source/Contract support: The current code defines this behaviour and is still influenced by the software and hardware version of the equipment.
* Local or browser tests: Validation of page, protocol or simulation interaction without substitute for real machine precision and flight integration.
* Historical reality: Only software, hardware, data sets and loads that should be specified are not automatically extended to new versions.
* Product presentation: Models, track animations, wave shapes and wiring are not current output of equipment.

Website performance data use  2026-10-17   EuRoC 11 Article and  UZH-FPV 16 Historical benchmarks.
Errors are used  SE(3) Alignment, no-scale correction, as  ATE RMSE / Corresponds to the true value of the journey.
The initialization delay is the first valid position on the data time axis and is not time-consuming.

“The plant is marked” for the maintenance of equipment matching the parameters of the plant. source=default It’s a nominal retreat.
It cannot be considered as an exit parameter; source=saved There is also a need to confirm the matching of sources.

System & Release
------------------

FAT32/exFAT and  firmware Upgrading requires supporting systems and it cannot be assumed that the old system has these capabilities.
Normal  OTA No relocation of the partition layout, specific card capacity and continuous writing speed will require card testing.
The compatibility of the flight depends on the solidware, the machine type and the generator configuration; the relative depth does not provide assurance of the distance to be measured in rice.

From  2026-11-12 Start, push the warehouse and get out of here.  GitHub Actions Build Product Pages and  Sphinx Documents,
It’s published as the same product.  GitHub Pages，_Other Organiser /docs/，No more relying  Read the Docs Backstage.
Old  readthedocs.io This document does not modify the device interface or algorithm.
Nor does this mean that all functionality is re-engineered.

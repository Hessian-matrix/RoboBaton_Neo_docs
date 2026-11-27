Insert and prepare  TF Cut.
=============================

TF Card microSD）This is used for the device side recording. The first view of the image and trajectory does not need a card.

.. figure:: _static/manual/tf-insertion.png
   :alt: Neo Long side. TF Cartwright. TF Cut. 8 One gold finger up, and the touch end follows the blue arrow to the sink first.
   :figclass: tf-insertion-figure

   Product Introduction Consistency Model: Goldfinger up, contact end first enters the slot.

**Stop recording and wait for the finish to be completed before the power plugs are cut.** Set the direction by the device in the chart, let  TF Carkin fingers head up and to the end of the contact point and enter the slot without forced penetration.

Preparation and confirmation
------------------------------

.. container:: computer-step

   .. rubric:: 01 · Find the slots, cut the plugs.

   I found the side of the body.  TF Cartwright, Jean. **Goldfinger up.**，Points the end of the contact point to the slot, and inserts it straight in the direction of the blue arrow. Stops when there is a clear resistance, rechecks the direction and avoids tilting or press hard.

.. container:: computer-step

   .. rubric:: 02 · Get on the phone and check the card status.

   Connect to power, open the device web page. **Data management** Page, waiting for system check and mount  TF card.
   Status as **ready** Then we’ll check the remaining space.

.. container:: computer-step

   .. rubric:: 03 · Record after testing

   Performs the recording test provided on the page to confirm availability by the selected data source and then starts recording.
   See specific recording, download and export operations :doc:`recording`。

.. container:: computer-success

   **The judgment to be completed.**：The card state is as  ready、The remaining space meets the current recording needs and the selected data source is recorded and tested.

We’ll see if we have any problems.
------------------------------------

.. raw:: html

   <details class='computer-help'><summary>Which formats are supported? How are the data available processed?</summary>

Auxiliary system support **FAT32 and  exFAT**，Use Unique  SD A single partition 1 or no partition table file system for cards.
When multiple partitions, unknown formats or checks fail, they are not automatically formatted or forced to write.

**Data are available to backup first.** ”Unmounted” cannot be understood directly as requiring formatting; check card status, exposure and documentation systems first.

.. raw:: html

   </details>
   <details class='computer-help'><summary>missing / unmounted / ready What’s the difference?</summary>

.. list-table:: Check by Status
   :header-rows: 1
   :widths: 23 35 42

   * - Status
     - Meaning
     - Next
   * - missing
     - No card detected
     - After the mission has been stopped and power has been cut, the direction and exposure are checked.
   * - unmounted
     - Device detected, not mounted
     - Waiting for system check; if not mounted, check file systems with partitions and do not format them directly.
   * - ready
     - Mounted and written
     - Check the remaining space and complete the recording tests.

.. raw:: html

   </details>

Security card
---------------

Stop recording, wait for completion, confirm that no card is written and then cut off and then remove the card.**Do not draw cards while recording or writing.**

.. container:: doc-next

   Ready after: Enter :doc:`recording`，Learn to record, download and export.

.. container:: product-footnote

   \* “”Upwards” with reference to the placement of the equipment in the chart, without changing the posture of the actual installation of the equipment; other hardware versions of the cell structure and locking pattern are based on the object.

Eject and recheck
----------------------------------------

POST /api/monitor/tf-card supports eject and recheck with the latest media_token from device
status. Query state after a lost response rather than replaying a stale token. Ejection requires
card reinsertion. An unclean-unmount flag can be cleared for mounting after a successful
read-only filesystem check; no automatic formatting or repair is performed.
GET /api/monitor reports card state, reason, token and whole-card read/write bytes per second.

Data recording and management
===============================

.. figure:: _static/manual/page-recordTab-annotated.png
   :alt: Filter source, storage status and recording list
   :target: _static/manual/page-recordTab-annotated.png
   :figclass: web-page-overview

   Select the image to view the controls

.. web-tutorials:: recording
   :title: Feature walkthrough
   :no-intro:
   :compact:

.. container:: doc-next

   Back :doc:`web-guide` Find other operations; interface field and program access :doc:`api-reference`。

.. container:: product-footnote

   \* Screenshots and videos use demonstration data.

Segments and automatic volumes
----------------------------------------

TF segments roll over at approximately 256 MiB or 10 minutes; H.264/H.265 waits up to 10 seconds
for a random-access frame. Browser recording no longer has a cumulative 256 MiB limit.
ZIP volumes roll over at approximately 256 MiB or 10 minutes; video grace limits are approximately
264 MiB or 10 minutes 2 seconds. Each volume has a separate recording ID and shares its session_id.
end_reason is volume_rollover or user_stop and is separate from completeness.
source_complete=null means unknown. See :doc:`recording-tools` for parsing, CSV and video exports.

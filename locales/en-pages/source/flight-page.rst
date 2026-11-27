Flight-controller connection
==============================

.. figure:: _static/manual/page-flightTab-annotated.png
   :alt: Access steps, search for flight control and connectivity
   :target: _static/manual/page-flightTab-annotated.png
   :figclass: web-page-overview

   Select the image to view the controls

.. web-tutorials:: flight
   :title: Feature walkthrough
   :no-intro:
   :compact:

.. container:: doc-next

   Back :doc:`web-guide` Find other operations; interface field and program access :doc:`api-reference`。

.. container:: product-footnote

   \* Screenshots and videos use demonstration data.

Control VIO over MAVLink
-------------------------

COMMAND_LONG uses the custom MAV_CMD_USER_1=31010 command. param1 is 0 for stop,
1 for start or 2 for restart; param2 is a request ID from 1 to 65535; param3..7 are zero.
Address the exact Neo system and component (default component 197); broadcast control is rejected.
ACK result_param2=(request_id<<8)|reason. Wait for the final result after IN_PROGRESS.
If a response is lost, query actual state before retrying; do not blindly repeat a restart.

GET/POST /api/mavlink/vio/config reads or saves rc_channel: 1..18, or null to disable.
Writes require a UUID Idempotency-Key and are persisted and applied immediately.
vio_control and the heartbeat report VIO state. A low value at or below 1300 stops VIO;
a high value at or above 1700 starts it after 300 ms of stability. Initial reception and
reconnection establish a baseline without triggering a command. The switch does not restart
VIO and is not a failsafe. It is disabled by default. Direct serial validation does not
establish acceptance of real flight-controller forwarding or RC switch operation.

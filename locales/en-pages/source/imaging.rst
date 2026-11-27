Images, IMU and depth
=======================

.. figure:: _static/manual/page-imaging-annotated.png
   :alt: Images, IMU Depth partition: camera preview, IMU Monitoring, relative depth
   :target: _static/manual/page-imaging-annotated.png
   :figclass: web-page-overview

   Select the image to view the controls

.. web-tutorials:: imaging
   :title: Feature walkthrough
   :no-intro:

.. container:: doc-next

   Back :doc:`web-guide` Find other operations; interface field and program access :doc:`api-reference`。

.. container:: product-footnote

   \* Screenshots and videos use demonstration data.

Image concurrency and frame rates
---------------------------------

GET/POST /api/gray/config supports raw grayscale at 5 fps (default) or 30 fps.
Raw 30 fps excludes full-resolution color, gray_jpeg and TF image recording; independent
preview can coexist. Depth can coexist with raw 30 fps only while VIO is off. Calibration
capture remains at 5 fps. Each image channel permits one HTTP subscriber; conflicting later requests are rejected.

Color rates are 60, 30, 20, 15, 12, 10, 6, 5, 4, 3, 2 and 1 fps. The maximum is 60 fps
with VIO off and 30 fps with VIO on. With VIO on, depth, raw grayscale, gray_jpeg or TF image
recording limits color to 5 fps. Use available_fps for currently selectable values;
fps_max does not imply that every lower integer is supported.

Independent preview alone does not reduce selectable color rates. Once color above 5 fps
actually produces frames, existing independent preview closes; a new preview request receives
409 IMAGE_CONFLICT. The page can display decoded color instead. Queries, configuration changes
alone and failed stream opens do not close preview. Color at 5 fps or below can coexist with
preview. Raw grayscale at 30 fps always excludes full-resolution color, and TF color recording
locks the complete encoder configuration. Preview starts when the page opens independently
of VIO. A manual stop survives tab changes; reloading the page starts preview again.

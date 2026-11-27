Parse recorded data
===================

Download and run
----------------

Download the complete package from :doc:`sdk`, extract it, and enter SDK/recording.
Python 3.8 or later is required; there are no third-party dependencies.
Use python on Windows or python3 on Linux/macOS.

.. code-block:: console

   cd SDK/recording
   python -m neo_recording inspect recording.tar
   python -m neo_recording check volume-001.zip volume-002.zip
   python -m neo_recording export recording.tar --output exported

Inputs can be TF-card TAR/TAR.GZ downloads, browser ZIP volumes, extracted recording
directories, or individual RBR segments. No archive extraction is needed. Inputs remain
unchanged and the output directory must not already exist. Supply every ZIP volume from
a browser session to check the session; one RBR segment only establishes local integrity.

Exported files
--------------

* report.json: validation results, channel counts, damaged segments and valid prefix lengths.
* records.jsonl: original metadata, payload paths and video stream byte offsets.
* imu.csv and odometry.csv: segment, source epoch, sequence, seconds, nanoseconds and full data_json.
* gray/ and color/: original JPEG frames or encoded access units, plus per-segment H.264/H.265 streams.
* Configuration and calibration: original manifest.json, result.json, mono.conf, calibration.json when present, and per-segment configuration.

data_json preserves original fields without interpolation, zero filling or coordinate conversion.
IMU acceleration uses m/s² and angular velocity uses rad/s. Pose frames and reference points
are explained in :doc:`sdk`. Device timestamps use CLOCK_MONOTONIC_RAW, not UTC.
Seconds and nanoseconds remain separate and sequence numbers retain integer precision.
Channels are stored in reception order, not necessarily global timestamp order; reception time is not exposure time.

Understand completeness
-----------------------

inspect and check perform the same read-only checks. Exit code 0 means the supplied data
passes the checks and completion declarations. Exit code 2 indicates incomplete or damaged
data or a reported issue. Export may still preserve valid records before a damaged tail;
always read report.json alongside the output.

* structurally_closed: segment structure and end records passed validation.
* declared_complete: the recorder's per-volume declaration in result.json.
* source_complete: source capture completeness; null means unknown, not lossless capture.
* issue_counts: total issue counts; issues contains up to 100 details per recording.
* terminal_volume_present: whether the user-stop volume was supplied. Rollover alone does not establish session completion.

Each browser volume has its own recording_id; a session shares session_id and volume starts at 1.
The tool reports missing or duplicate volumes, sequence gaps, timestamp regressions, count mismatches
and missing calibration. A valid CRC cannot establish that no source data was lost during a disconnect.

Video and volume boundaries
---------------------------

H.264/H.265 exports are Annex B elementary streams, not MP4 files. The tool preserves access
units without decoding video. A browser volume can start on a frame that is not a random-access
frame. Keep the preceding volume or start decoding at the next valid random-access frame.
Only concatenate after checking codec configuration, source epochs and session order.
The tool does not concatenate volumes automatically. A player's nominal frame rate does not
replace the sensor timestamps in records.jsonl.

Python integration and validation
---------------------------------

.. code-block:: console

   python examples/read_recording.py recording.tar
   python tests/test_recording.py -v

Use neo_recording.iter_records to read records incrementally with original bytes payloads;
corruption raises an exception. The parser targets v2.0.0. Regression tests use synthetic
fixtures and do not constitute device recording or video decoder acceptance.
See SDK/recording/README.md and :doc:`recording` for recording operations.

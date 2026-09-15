RAJU MOTOR DRIVING SCHOOL — PREMIUM HPT PROTOTYPE v1
====================================================

This package is a fresh HPT interface, separate from the Defensive Driving Seminar.
No seminar files, tables, RPCs, attendance, booking or certificate logic are included.

MODES
-----
1. Practice Test:
   - replay enabled
   - previous/next enabled
   - immediate response flags and scoring
   - suitable for training

2. Actual Examination:
   - 10-clip structure
   - no replay / previous / next controls during the test
   - clips advance automatically and play automatically
   - 100 marks total
   - 60 marks pass
   - max 5 responses per clip
   - 6th response makes that clip score 0
   - each hazard can score once

SCORING
-------
Friendly training/exam timing:
0–1.5 sec after developing point = 5
1.5–2.5 sec = 4
2.5–3.5 sec = 3
3.5–5 sec = 2
after 5 sec = 0

CURRENT LOCAL VIDEOS
--------------------
Clip 01–04 are the four approved local videos supplied for this project.
Clip 05–10 are deliberately not replaced with fake/looped/remote footage.
They are reserved for the remaining six real/generated videos.

VIDEO GENERATION NOTE
---------------------
At build time the connected video-generation workspace has no available credits
or free generations, so Clips 05–10 have not been falsely represented as generated.

BRANDING
--------
The current build uses the Raju "R" brand mark as a local vector-style logo treatment.
Replace it with the school's exact logo asset once supplied.

NEXT INTEGRATION
----------------
This is intentionally separate from the existing website's Defensive Driving Seminar.
When approved, the HPT module can be connected to the existing student login/dashboard
and a new HPT-only database/RPC layer without changing the seminar implementation.


V2 — LOGIN REMOVED
==================
The HPT module now opens directly to the Raju HPT Dashboard.
There is no separate HPT login screen.

When this module is integrated into the existing Raju website, the existing student
authentication can identify the student. The HPT module should not ask for mobile/DOB
again.

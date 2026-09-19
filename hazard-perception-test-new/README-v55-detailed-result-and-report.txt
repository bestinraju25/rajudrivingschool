HPT v55 - Detailed Result & Evidence Report
- Added VIEW DETAILED RESULT on the result screen.
- Interactive scrollable modal shows every exam clip, clip score, each official hazard, hazard label, official hazard time, candidate response time, reaction time, marks, and evidence images.
- Evidence image loading uses the actual video frame first and a clip thumbnail fallback if browser/CORS restrictions prevent frame capture.
- PDF evidence capture retries video frame extraction and uses thumbnails instead of black empty boxes.
- PDF cards increased from 8 to 6 per page with larger evidence images for improved readability.
- Added cache-busting version 55 to CSS/JS/report assets.

RAJU DRIVING SCHOOL — HAZARD PERCEPTION TEST
Production architecture

Candidate
- index.html is the Actual Test only.
- No Practice section.
- 10 clips are randomly selected from the active HPT library.
- Candidate enters name and phone for test reference.
- Responses are timed against the two hazard timestamps for each clip.
- Supabase stores attempts, responses, scores and small video metadata only.

Video storage
- Video binaries are NOT stored in Supabase.
- Static videos belong in the site's GitHub/static `videos/` directory.
- Admin can preview a local file, mark Hazard 1 and Hazard 2, and save the metadata to Supabase.
- "PREPARE GITHUB PUBLISH PACKAGE" downloads the selected video plus a JSON annotation file for publishing.
- For fully automatic GitHub publishing from the live admin page, use a secure server/edge endpoint; never put a GitHub write token in browser JavaScript.

Supabase
- Run supabase-schema.sql in the Supabase SQL editor.
- hpt_videos and hpt_hazards contain metadata only.
- hpt_attempts and hpt_responses contain candidate results.
- Existing Defensive Driving Seminar tables/RPCs are not referenced by this HPT package.

Current bundled video files: 1.webm through 10.webm. The application supports adding 11.webm through 36.webm and beyond.

# Raju Driving School — Defensive Driving Seminar v22

## Focus
For now the public website entry point redirects to the Defensive Driving Seminar only. Existing driving-class, student-learning, instructor and finance files are retained but are not linked from the public/admin seminar UI.

## Public
- `/defensive-driving-seminar/` — mobile-first seminar booking
- Name + mobile are required; email is optional; DOB removed
- One active booking per mobile
- QR pass after booking
- Mobile-only booking lookup/cancellation

## Admin
- `/admin-dashboard/` — seminar-only dashboard
- `/admin-dashboard/seminars/attendance.html` — QR scanner + attended/not-attended reports
- `/admin-dashboard/seminars/participants.html` — participant management

## Supabase
Run `defensive-seminar-v22.sql` after the previous seminar migrations. It drops the email NOT NULL constraint and recreates the booking RPC with optional email.

## QR flow
The scanner first requests camera access using `getUserMedia`, then starts `html5-qrcode`. A successful scan stops the camera and opens a success dialog with name, mobile, seat, booking ID and attendance time. The admin must press `OK — Scan next participant` before the camera resumes.

## Important
The browser controls camera permission; a website cannot force-grant it. If permission is denied, allow camera for the exact HTTPS origin and retry.

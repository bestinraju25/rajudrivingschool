# Defensive Driving Seminar Booking — Setup

1. Open Supabase SQL Editor for the Raju Driving School project.
2. Run `defensive-driving-seminar.sql` once.
3. Insert or create the real seminar session. The admin page can create/edit sessions after the SQL has been run.
4. Open `/admin-dashboard/seminars/` and create the event with the real date, time and venue. Capacity is capped at 90.
5. Publish the complete website build.

Public booking page: `/defensive-driving-seminar/`

Features:
- Public registration without student login.
- Hard 90-seat capacity enforced in a database transaction.
- Duplicate protection by mobile number and email for the same event.
- Automatic seat number and booking ID.
- Mobile-friendly QR entry pass.
- Admin participant list, search, cancel/restore and attendance marking.
- Seminar sessions can be activated/hidden from the admin dashboard.

Important: do not put a Supabase service-role key in the website. The existing publishable key is used in the browser and the registration RPC is protected with database-side capacity locking.

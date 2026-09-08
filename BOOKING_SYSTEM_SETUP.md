# Raju Driving School – Booking System Setup

## Supabase configuration

The website uses the Supabase project URL and browser-safe publishable key in `student-config.js`.

**Never put a Supabase service-role/secret key in the website.**

## Database repair / booking calendar

Your current database already has the important booking overlap constraints. The previous migration attempted to use `ON CONFLICT` in places that did not match the current database shape.

Use **`booking-migration-final-repair.sql`** in Supabase SQL Editor.

It installs/repairs and safely normalizes legacy booking columns:

- 5 instructors: Yashodaran, Francis, Ranjith, Akhil, Lissy
- student calendar availability RPC
- 1-hour and 2-hour booking RPC
- instructor overlap protection
- instructor unavailable/leave blocks
- manual fee ledger
- admin approval requiring instructor assignment and full booking fee
- RLS policies and indexes

### Student workflow

1. Student logs in.
2. Selects an instructor from the dropdown.
3. Selects a date from the calendar.
4. Sees 1-hour slots from 8:00 AM through 6:00 PM.
5. Available slots are selectable.
6. Existing bookings appear as **Booked**.
7. Instructor leave/blocked periods appear as **Not available**.
8. Student can select 1 hour or 2 consecutive hours.
9. Booking is created as **Pending Payment** and the slot is reserved.

### Admin workflow

1. Admin opens `/admin/`.
2. Reviews booking requests.
3. Assigns/changing instructor if needed.
4. Sets the class fee.
5. Records manually collected payment.
6. Approves the booking only after the full booking fee is recorded.
7. Can block instructor time for leave/maintenance/meetings.
8. Can record general course payments and update total course fee.

## Important

Do not run the old 400+ line booking migration repeatedly. Use the final repair script above against the current database.

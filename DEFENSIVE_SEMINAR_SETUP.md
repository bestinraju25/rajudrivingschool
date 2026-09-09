# Defensive Driving Seminar — Setup

## Original setup
Run `defensive-driving-seminar.sql` once in the Supabase SQL Editor.

## If v17 is already installed
Run `defensive-seminar-management-migration.sql` to add the management upgrade without recreating the tables.

## New in this upgrade
- Admin venue check-in panel: search Booking ID, mobile or participant name and mark confirmed participants as **Attended**.
- Admin participant table also has **✓ Mark attended**, **Undo attendance**, **Restore**, and **Delete** actions.
- Admin **Delete** permanently removes a seminar booking and releases its seat.
- Public page has **Already registered? Manage your booking**.
- User can enter Booking ID + registration mobile to retrieve booking details and **Cancel my booking**.
- User cancellation releases the seat automatically.
- Attended bookings cannot be cancelled online.

## Important
The 90-seat limit remains database-enforced. Cancellation or admin deletion releases the seat, so it can be booked again.

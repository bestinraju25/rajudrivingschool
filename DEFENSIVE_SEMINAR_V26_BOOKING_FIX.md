# Defensive Driving Seminar v26 — Booking Code Fix

Run `defensive-seminar-v26-booking-code-fix.sql` in Supabase SQL Editor.

## What this fixes
- Resolves `duplicate key value violates unique constraint "seminar_registrations_booking_code_key"`.
- Booking codes are now globally unique even when cancelled/legacy seats are reused.
- Email remains optional; full name + 10-digit mobile is sufficient.
- One active booking per mobile remains enforced.
- Cancelled seats remain reusable.

## New booking-code format
`RDS-DS-YYYYMMDD-SEAT-RANDOM`

Example: `RDS-DS-20260912-01-7A3F91C2`

The QR code and admin scanner continue to use the booking code returned by the RPC, so no frontend scanner change is required.

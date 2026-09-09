# Defensive Driving Seminar v27

The booking error in v26 was caused by `gen_random_bytes(4)`, which is not available when PostgreSQL pgcrypto is not enabled.

v27 removes that dependency and generates the unique booking-code suffix with PostgreSQL built-in `md5()`.

Run `defensive-seminar-v27-booking-fix.sql` in Supabase SQL Editor. Existing registrations are preserved. Email remains optional and cancelled seats remain reusable.

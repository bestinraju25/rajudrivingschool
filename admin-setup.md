# Raju Driving School — Admin setup

1. Create an admin account in Supabase Authentication > Users using an email and a strong temporary password.
2. Copy that user's UUID.
3. Run the final INSERT shown at the bottom of `booking-schema.sql` in SQL Editor, replacing the UUID/email.
4. Sign in at `/admin/`.
5. Change the temporary password using Supabase Auth's password reset flow or the admin account's password management.

Do not place a Supabase service-role/secret key in browser code.

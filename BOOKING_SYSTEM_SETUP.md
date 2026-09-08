# Raju Driving School Booking System

## Flow

Student signs up → logs in → requests a 1/2/3 hour class → optional instructor preference → admin reviews → admin assigns instructor → admin records manual payment → system marks booking `payment_recorded` once the full booking fee is paid → admin approves → class can later be marked completed.

## Admin

Admin signs in at `/admin/` and works from `/admin-dashboard/`.

The five seeded instructors are:

1. Yashodaran
2. Francis
3. Ranjith
4. Akhil
5. Lissy

Admin can:

- see all bookings
- assign instructors
- set/override booking fee
- record manual payments
- approve only after full booking fee is recorded
- mark a class completed
- cancel a booking
- block instructor leave/unavailable time
- set the default hourly class fee
- view the payment ledger

## Security

- Supabase Auth handles passwords.
- Browser code contains only the publishable key.
- Student RLS limits students to their own bookings/payments/profile.
- Admin access requires a matching active row in `admin_users`.
- Database triggers prevent student users from self-assigning instructors or approving their own bookings.
- Database conflict checks prevent overlapping instructor bookings and unavailable blocks.


## Student registration details upgrade

The registration form now collects date of birth, blood group, full address, pincode, and applying-for category (LMV + M/cy, LMV only, or M/cy only). If the original schemas were already run, execute `student-registration-upgrade.sql` once in Supabase SQL Editor before testing new signups.

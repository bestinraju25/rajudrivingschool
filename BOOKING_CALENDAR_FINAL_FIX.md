# Raju Driving School — Final Student Booking Fix

## 1. Deploy the website
Upload/push the complete website in this ZIP to GitHub Pages as usual.

## 2. Run the database repair once
In Supabase SQL Editor, open and run:

`booking-calendar-final-repair.sql`

This fixes two database issues:

- The availability RPC no longer has an ambiguous `status` reference.
- Booking start-time validation now checks India local time (`Asia/Kolkata`) instead of UTC. This is important because 10:00 AM IST is 04:30 UTC, so the old UTC minute check incorrectly rejected every hourly slot.

## 3. Student profile
The Edit profile button now opens a centered modal with a dimmed background instead of expanding a form underneath the profile card.

The modal can be closed with:
- Cancel
- X
- Clicking the dark backdrop
- Escape key

## 4. Booking
After running the SQL repair:

1. Log in as a student.
2. Select an instructor.
3. Select a future date.
4. Select an available hourly slot.
5. Choose 1 hour or 2 hours.
6. Click `Book selected slot`.

A successful booking is created with `pending_payment` status and will appear under My bookings.

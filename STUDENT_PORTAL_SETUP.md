# Raju Driving School — Student Portal Setup

The base website is a static HTML/CSS/JavaScript site. The new student portal uses Supabase for authentication and PostgreSQL data while the website can continue to be deployed from GitHub.

## 1. Create Supabase project

Create a project at https://supabase.com/.

In **Project Settings → API**, copy:
- Project URL
- Publishable key (or legacy anon key)

Put them in `student-config.js`:

```js
window.RAJU_SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
window.RAJU_SUPABASE_ANON_KEY = 'YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY';
```

Never put a `service_role` key in the website.

## 2. Create the database table

Open **SQL Editor** in Supabase and run the complete contents of `supabase-schema.sql`.

The trigger automatically creates a `student_profiles` row when a student signs up. The table is protected by Row Level Security so a student can only read/update their own profile.

## 3. Configure email authentication

In Supabase go to **Authentication → Providers → Email** and enable Email/Password.

For the first deployment, email confirmation can remain enabled. Students will receive a confirmation email before they can log in.

## 4. Configure redirect URLs

In **Authentication → URL Configuration**, set the Site URL to:

`https://www.rajudrivingschool.com`

Add these Redirect URLs:

`https://www.rajudrivingschool.com/student/`

`https://www.rajudrivingschool.com/student/reset-password.html`

If the site is also available without `www`, add the equivalent non-www URLs too.

## 5. Student portal URLs

Login / Sign up:

`https://www.rajudrivingschool.com/student/`

Protected dashboard:

`https://www.rajudrivingschool.com/student-dashboard/`

The dashboard checks the Supabase session and redirects unauthenticated visitors back to the student login page.

## 6. GitHub deployment

Commit the changed files to your existing repository. Your static hosting can continue serving the frontend. Supabase is the separate backend/database service.

Important: the Supabase browser key is a public client key. Security comes from Supabase Auth + Row Level Security, not from hiding the key.

## 7. Next development phase

The portal is intentionally a foundation. The dashboard currently has placeholders for:
- Lessons / learning hub
- Progress
- Student records
- Certificates

Later we can add course enrolment, lesson completion, video access, mock-test scores, attendance, certificates and an admin portal without replacing the authentication foundation.

## Booking, admin and manual fees

After the original student schema has been run, also run `booking-schema.sql` once. It adds:

- Five instructors: Yashodaran, Francis, Ranjith, Akhil and Lissy.
- Hourly class fee setting.
- Student booking requests with 1/2/3 hour durations.
- Optional preferred instructor; admin makes the final assignment.
- Instructor unavailable/leave blocks.
- Conflict protection so an instructor cannot be double-booked or assigned during a blocked time.
- Manual fee-payment ledger with date, amount, method, receipt and notes.
- Approval workflow: assign instructor + record the full booking fee + approve.
- Admin role protection through `admin_users` and Supabase Auth.

### Create the first admin

1. In Supabase, go to **Authentication → Users** and create an admin user with an email and a strong temporary password.
2. Copy the user's UUID.
3. In SQL Editor run:

```sql
insert into public.admin_users (id, email, full_name)
values ('PASTE-AUTH-USER-UUID-HERE', 'admin@rajudrivingschool.com', 'Raju Driving School Admin');
```

4. Sign in at `/admin/`.
5. Change the temporary password after the first login.

Never put a Supabase secret/service-role key in `student-config.js` or any browser file.


## V7 updates

- Student dashboard now has an **Edit profile** form for name, phone, date of birth, blood group, applying-for category, pincode and address.
- Admin dashboard now has **Approve, Reject, Cancel and Complete** actions, instructor assignment, fee editing, admin notes, payment recording and instructor activation/deactivation.
- Admin has a daily **instructor timetable** showing Available, Pending/Payment, Approved/Completed and Blocked/Leave slots.
- Admin can add instructors and block/remove instructor time from the availability section.
- `booking-calendar-repair-v7.sql` fixes the PostgreSQL `column reference "status" is ambiguous` error in the student calendar RPC.
- Admin payment queries no longer rely on a missing Supabase relationship between `fee_payments` and `student_profiles`; the dashboard maps student IDs in the browser.

### Important database step

If the student booking page currently says **"column reference status is ambiguous"**, run the entire `booking-calendar-repair-v7.sql` file once in Supabase SQL Editor. A successful result will say: **Raju Driving School V7 booking calendar repair completed successfully.**

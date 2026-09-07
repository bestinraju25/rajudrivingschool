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

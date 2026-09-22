# Raju Driving School — basic_lesson_class

A multi-page classroom extension designed to sit under the existing `raj...` website and reuse the same Supabase project.

## Structure

- `index.html` — extension landing/chooser.
- `student/index.html` — classroom dictionary/library.
- `classroom/index.html` — full-screen one-by-one lesson player.
- `admin/login.html` — Supabase Auth admin login.
- `admin/index.html` — content manager: add/edit signs, upload photo, upload instructor video by `sign_id`.
- `assets/css/app.css` — shared UI.
- `assets/js/config.js` — shared Supabase project URL, REST API URL reference, and browser-safe publishable key.
- `assets/js/supabase.js` — shared client and auth helpers.
- `assets/js/student.js` — student dictionary logic.
- `assets/js/classroom.js` — TV/classroom player logic.
- `assets/js/admin.js` — admin dashboard and upload logic.
- `supabase/schema.sql` — tables, RLS policies, Storage bucket, and starter sign data.
- `data/` — source JSON used for the starter lesson library.

## Supabase setup

1. Open your existing Raju Driving School Supabase project.
2. Run `supabase/schema.sql` in the SQL Editor.
3. Create an admin user in **Authentication → Users** using the email/password login method.
4. Copy that user's UUID into `public.lesson_admins` using the commented SQL at the bottom of `schema.sql`.
5. Edit `assets/js/config.js` with the same Supabase project URL and publishable key already used by your website.

Only the **publishable key** belongs in frontend code. Never put a Supabase service-role/secret key in this project.

## Media model

Every learning item has a permanent text ID, for example `man_01`.

The relationship is:

`sign_id → lesson_signs row → lesson_media row → Storage photo/video paths`

Recommended Storage paths:

- `signs/<sign_id>/photo.<ext>`
- `signs/<sign_id>/video.<ext>`

The admin page writes the matching `lesson_media` row automatically after upload.

## Classroom flow

Student opens `student/index.html` → selects a sign → clicks **Play Classroom** → `classroom/index.html` opens → the user clicks **Start Lesson** → browser enters full-screen → the sign appears on the left and the matching instructor video plays on the right → when the video ends, the next sign loads and its matching video starts.

For missing videos, the player clearly shows `Instructor video not uploaded` and can automatically advance after a short delay.

## Deploy as website extension

Recommended path:

`raj.../basic_lesson_class/`

The project is intentionally static. It does not require Node for production hosting. It can be placed in the same website repository, served from GitHub Pages/Cloudflare Pages, or hosted under the existing site as a subfolder.

## Important

The starter library comes from the current classroom content and is editable from Admin. Before commercial/official classroom use, verify the exact sign set, wording, images and MVD/RTO training content you want to publish.

## Shared Supabase project

This package is configured for the existing Raju Driving School Supabase project. The browser uses the publishable key only. The Supabase secret/service-role key must remain outside the frontend and must never be committed to GitHub, the website, or this ZIP.

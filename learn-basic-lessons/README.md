# Raju Driving School — basic_lesson_class

A multi-page classroom extension designed to sit under the existing `raj...` website and reuse the same Supabase project.

## Structure

- `index.html` — extension landing/chooser.
- `student/index.html` — classroom dictionary/library.
- `classroom/index.html` — full-screen one-by-one lesson player.
- `admin/login.html` — Supabase Auth admin login.
- `admin/index.html` — content manager: add/edit signs, upload photo, upload instructor video by `sign_id`.
- `assets/css/app.css` — shared UI.
- `assets/js/config.js` — Supabase URL + anon key placeholders.
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
5. `assets/js/config.js` is already configured for the same Supabase project used by the Raju Driving School website.

Only the **publishable key** belongs in frontend code. Never put a Supabase secret/service-role key in this project.

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

## Admin login troubleshooting

The admin login uses Supabase Authentication with email + password.
There is no hard-coded admin password.

1. Create the user in Supabase Dashboard -> Authentication -> Users.
2. Copy the user's Auth UID.
3. Run `supabase/create_admin.sql` after replacing `YOUR-AUTH-USER-UUID-HERE`.
4. Open `/basic_lesson_class/admin/login.html` and sign in with that Auth email/password.

If login says the account is authenticated but not authorized, the user's UID has not been added to `public.lesson_admins`.
If the page reports a JavaScript/module error, verify that `assets/js/supabase.js` is present and is the client helper file, not the README.


## Poster-based sign images
This build includes cropped sign images derived from the user-provided classroom poster image. The app uses these as default images until an administrator uploads a dedicated photograph for a sign. Uploaded Supabase Storage media always takes precedence. Run `supabase/upgrade_poster_signs.sql` after the original schema to add the expanded poster-derived catalogue.

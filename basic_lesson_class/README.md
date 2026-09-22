# Raju Driving School — Basic Lesson Class

A multi-page classroom extension designed to sit under the existing Raju Driving School website and reuse the same Supabase project.

## Pages

- `/index.html` — landing page / navigation
- `/student/index.html` — student sign & lesson library
- `/classroom/index.html` — TV/projector classroom lesson player
- `/admin/login.html` — Supabase Auth admin login
- `/admin/index.html` — lesson content manager

## Supabase

This build is already configured for the existing Raju Driving School Supabase project in:

`assets/js/config.js`

Only the Supabase project URL and publishable key belong in browser code. Never add a Supabase secret/service-role key to this project, ZIP, GitHub, or frontend JavaScript.

### First-time admin setup

1. In Supabase Dashboard, go to **Authentication → Users**.
2. Create an admin user with email + password.
3. Copy that user's UUID.
4. Open `supabase/create_admin.sql`.
5. Replace `YOUR_AUTH_USER_UUID` with the UUID.
6. Run the SQL in Supabase SQL Editor.
7. Open `/admin/login.html` and sign in with the Auth email/password you created.

There is **no hard-coded admin password** in this build.

## Media model

Every lesson/sign has a permanent text `sign_id`.

The media relationship is:

`sign_id → photograph → instructor video`

Media is stored in the `lesson-media` Supabase Storage bucket, and the matching paths are kept in `public.lesson_media`.

Example:

`man_01 → Stop photograph → Stop instructor video`

The Admin Manager lets you add/edit lesson records and upload or remove the photograph and instructor video for each ID.

## Classroom TV mode

Open `/classroom/index.html`.

- Start the lesson.
- The browser requests full-screen mode.
- The current sign/photo is shown on the left.
- The matching instructor video is shown on the right.
- The video starts automatically when the browser allows autoplay.
- When the video ends, the next sign loads and its matching video starts.
- Previous/Next and full-screen controls are available.

If a lesson has no instructor video, the player shows a clear missing-video message and advances automatically after a short delay.

## Deployment

This is a static web project. It can be deployed under the existing Raju Driving School site as:

`/basic_lesson_class/`

No Node.js server is required for the static frontend.

## Recommended media organization

Use the permanent `sign_id` as the logical key. The frontend currently uploads media using paths similar to:

`signs/{sign_id}/photo.jpg`

`signs/{sign_id}/video.mp4`

## Notes

The starter sign library is editable from Admin. Before official classroom/commercial use, verify the exact sign set, wording, images, and regulatory training content you want to publish.

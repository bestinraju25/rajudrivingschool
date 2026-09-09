# Raju Driving School — Defensive Driving Seminar v21

## What changed
- Public seminar sessions are now tappable cards. Tapping a card opens a mobile-friendly registration sheet.
- Required registration fields: Full Name + Mobile Number.
- Email is optional. Driving Licence is optional under Additional Details.
- Date of Birth has been removed from the public registration flow.
- One active seminar booking per mobile number across the seminar programme.
- Public "My booking" lookup uses only the 10-digit mobile number.
- If legacy data ever contains more than one active booking for a mobile number, all matching bookings are listed so the participant can cancel the required one.
- Cancelled bookings release their seat; the next booking uses the first available seat.
- Admin QR check-in is event-scoped and uses `html5-qrcode` rather than relying on the browser's `BarcodeDetector` API.
- Camera diagnostics handle HTTPS, permission denied, no camera, camera-in-use and other common errors, with a Retry button.
- Admin exports remain available for Attended and Non-attended participants.

## Supabase
Run `defensive-seminar-v21.sql` after the existing seminar setup and v20 QR migration.

The migration drops the older unscoped one-argument QR RPC and creates the event-scoped two-argument version. The admin page calls the new RPC.

## Deployment
Replace the website files with the complete v21 ZIP. Do not copy only the seminar page if you want the full Raju Driving School portal/admin build preserved.

After deployment:
1. Hard refresh the admin page (`Ctrl+F5` on desktop).
2. Open Admin → Seminars.
3. Select the correct seminar session.
4. Tap **Scan QR code**.
5. Allow camera access when the browser asks.
6. If Brave still blocks it, use the site controls next to the address bar and set Camera to Allow, then tap **Try camera again**.
7. Scan a real entry-pass QR. Attendance should change to **Attended** immediately.

Camera permission cannot be granted programmatically by a website; the browser/device must grant it. v21 uses a dedicated QR scanning library plus explicit diagnostics to make the permission and camera path more reliable across mobile browsers.

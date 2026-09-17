RAJU HPT v43 — BROAD SMART-TV COMPATIBILITY

Base:
Raju-HPT-v41-Mobile-Exam-Screen-Fix

This version keeps the v41 desktop/mobile HPT experience as the base and adds a conservative compatibility layer for Smart-TV browsers.

Changes:
- Local public JavaScript is transpiled to ES5-compatible syntax for older TV browser engines.
- Added lightweight ES5/polyfills for Array/String/NodeList/Promise/requestAnimationFrame gaps commonly encountered on older embedded browsers.
- Removed Supabase JS and jsPDF CDN scripts from the initial page load. Supabase operations use a small HTTPS REST/XHR fallback so the HPT can initialize even when a TV browser cannot load the modern Supabase client.
- jsPDF is loaded only when certificate printing is requested.
- Added TV-browser detection and a low-complexity visual mode that removes expensive animation/effect dependencies.
- TV loading animation is skipped so the exam UI is not blocked by an animation engine.
- Added H.264/MP4 854x480 fallback copies in videos-tv2/ for the 10 bundled clips. TV browsers prefer these files; normal desktop/mobile browsers continue to use the original WebM clips.
- If a primary video source fails, the player attempts the alternate local format.
- TV playback disables HTML video controls, Picture-in-Picture and remote playback where supported.
- TV clips are muted for autoplay-policy compatibility. The bundled HPT clips contain no audio track.
- The next TV clip is lightly preloaded to reduce the transition gap.
- Added 100vh fallbacks for newer dvh viewport units.

Important:
This is a broad compatibility hardening pass, not a guarantee for every legacy TV ever made. Very old proprietary browsers may still lack HTTPS, video, JavaScript or CORS capabilities required by any modern web application.

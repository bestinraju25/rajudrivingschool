HPT v57 - Local Video Playback Fix
- Removed crossOrigin=anonymous from the main exam video element; this can interfere with local file:// playback.
- Added a muted-autoplay fallback for browsers that block the unmuted video after asynchronous access-code verification.
- The video is unmuted immediately after muted playback succeeds when sound is enabled.
- Road ambience is started directly from the START EXAM interaction.
- Keeps the immediate engine sound and automatic fullscreen behavior from v56.

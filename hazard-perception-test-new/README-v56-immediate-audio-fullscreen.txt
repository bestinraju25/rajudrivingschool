HPT v56 - Immediate Engine Audio + Automatic Exam Fullscreen
- Preloads and decodes start-test-engine-sound.mp3 when the page initializes.
- START EXAM triggers the decoded engine audio immediately from the button interaction.
- START EXAM also requests browser fullscreen immediately from the same user gesture.
- On completion, fullscreen is exited automatically before the result screen is shown.
- Manual Exit Exam also exits fullscreen.
- Browser/device fullscreen restrictions are handled gracefully; if denied, the exam continues.

# Auth QA (Playwright)
This suite QA's Google OAuth, Magic Link, and Smart One-Click on a deployed URL (Preview or Prod).
Nothing in app code is touched; tests live under `.qa/` and run via a GitHub Action.

## Run locally
1) export PREVIEW_URL="https://<your-vercel-preview-or-prod-domain>"
2) cd .qa && npm i && npx playwright install --with-deps && npx playwright test

## What we assert
- /env.js returns 200 and injects globals
- /get-started renders and Vue is available
- Smart One-Click: when One Tap is unavailable (GIS blocked) it redirects to OAuth
- Continue with Google: redirects to Supabase/Google OAuth
- Magic Link: sends POST to /auth/v1/otp on your Supabase project
- ?autostart=1 behaves like Smart One-Click

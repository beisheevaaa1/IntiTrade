# IntiTrade browser tests

The suite runs the same public and authentication journeys in desktop Chromium
and a Pixel 7 viewport. API calls are intercepted by `fixtures.ts`: known reads
return deterministic data and any unrecognised request is blocked and fails the
test. Registration checks therefore never create real users.

## Run locally

```powershell
npm run test:e2e:install
npm run test:e2e
```

To reuse an installed Chrome without downloading Playwright Chromium:

```powershell
$env:PLAYWRIGHT_CHANNEL = "chrome"
npm run test:e2e
```

`E2E_BASE_URL` may point at an already running frontend. The API guard remains
active in this mode, including when the target is a deployed site.

Use `npm run test:e2e:list` to validate test discovery without launching a
browser and `npm run test:e2e:headed` for interactive debugging.

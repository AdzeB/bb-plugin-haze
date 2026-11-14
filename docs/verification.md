# Verify Haze before a release

Run `npm ci`, `npm run typecheck`, `npm test`, and `bb plugin build .`.
The SVG import tests accept self-contained animated artwork and reject malformed,
active, external, or oversized content.

## Check the running app

Use an isolated BB instance with its own data directory on port 38962. Install
this checkout there and complete its setup. Keep your normal BB instance separate.
The browser checks create and remove a custom backdrop in the test instance.

Open a headless session with `bb browser-automation open --backend local --headless
--machine <host-id> --json`. Navigate its `main` page to
`http://127.0.0.1:38962/settings/plugins/haze?verify=1`.

Run `tests/verify-browser.js` with `bb browser-automation run <session-id>
--script-file <absolute-path>/tests/verify-browser.js --script-host <host-id>
--timeout-ms 45000 --json`. Repeat after changing the page's `verify` query to
`2`, `3`, and `controls`. Each group writes `haze-browser-<group>.json` to session
storage, with one result per check. The groups keep every browser call below the
host's command deadline.

The checks drive all 21 built-in scenes, verify their appearance, switch paired
artwork, and change the conversation scope. They also create, preview, save,
reload, download, and remove a custom backdrop, then reject malformed artwork.
The Motion check verifies that a saved custom scene uses its still composition.

Run `tests/verify-motion.js` the same way, after navigating to the Haze settings
page with `?motion=on`, then `?motion=off`, then `?motion=reduce`. The first run
uploads an SVG with both CSS and SMIL animation. Each run captures two actual
frames, compares their bytes, and saves a result in session storage.

Capture Honu Lagoon and a custom scene at desktop and phone sizes. Check text
legibility and horizontal overflow. Compare two frames with Motion on, with
Motion off, and with the browser's reduced-motion preference enabled. Moving
frames must differ; the two resting frames must match. Test an SVG with both
CSS and SMIL animation.

Close the headless session and stop the isolated server when finished.

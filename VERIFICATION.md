# Verification and limits

## Execution routing source checks - November 20, 2026

- All 45 app tests and four neutral-copy configuration tests passed on this
  starter base, along with TypeScript and the production build.
- A fresh local D1 database and built Worker passed persistence, legacy/Auto/Local/
  Cloud/default/override/non-Kai/scheduling, MCP all/ready/detail, claim/begin,
  and synthetic unsent-draft checks. No external jobs or email actions ran.
- Desktop and 390 x 844 browser checks covered new cloud defaults, changed-default
  isolation, task overrides, empty cloud saves, reload, legacy notes edits, hidden
  non-Kai controls, retained-claim edits, Back/Forward and footer Back.
- Only generic runtime changes, synthetic tests and neutral documentation are
  included. Hosting identity stays unset; example defaults and licenses remain.
- Live repository/environment discovery, real launches, physical phones, fresh
  independent hosting and unattended execution remain unverified. This is a
  source update; the existing downloadable release is unchanged.

## v0.2.0 source checks — November 19, 2026

- All 39 app tests and four neutral-copy configuration tests passed, along with
  TypeScript and the production build before release preparation.
- The navigation source matches the application checked in a simulated browser
  at 390 × 844: browser Back, the blue return button, Forward, page refresh,
  six repeated project-navigation cycles, and Back leaving from the Project List.
- The application owner separately confirmed that the deployed navigation works
  on their phone. The phone/browser model was not reported; this is not evidence
  of installing a separate starter deployment on another person's device.
- Release preparation changes version metadata and documentation only. The
  calendar/navigation implementation and locked dependency versions are unchanged.

Each release ZIP records its exact public source commit in
`STARTER-PROVENANCE.json`; its companion `.sha256` file identifies the uploaded
archive. The release notes record package checks and any remaining limits.

## Calendar source checks — November 17, 2026

- All 39 app tests and four neutral-copy configuration tests passed.
- TypeScript and production builds passed in both maintained repositories.
- Calendar/date tests also passed with Pacific/Auckland as the process timezone.
- The corresponding application flow passed isolated local D1/API and built-Worker
  browser checks: project return, month/week/day, task rescheduling, standalone
  due/action entries, deletion/restoration, persistence, DST and access rejection.
- At 390 px, the page fits; month/week scroll within the calendar and day fits.
  Dialog Escape restores focus. Keyboard/date controls and textual labels were checked.
- Only reviewed generic files were transferred. The Site identity stays unset,
  example defaults and licenses stay intact, and private history is excluded.

These are source checks, not a new downloadable release or an independent hosted
starter installation. Real phone hardware and a full assistive-technology audit
remain unverified. The local Vinext development optimizer had a dependency-loading
failure; browser checks used the successful built Worker with a loopback-only
synthetic sign-in gateway, documented in `docs/CALENDAR.md`.

## v0.1.1 release checks — November 16, 2026

The release ZIP was extracted into a fresh folder and installed with the locked
dependencies using `npm run install:ci`. Checks passed for:

- All 33 app tests, including another run after configuring a synthetic owner.
- Four configuration tests on the neutral starter, including both optional sync
  endpoints, invalid input, and rejection of an already-bound Site identity.
  These tests correctly skip in a configured copy; app tests remain available.
- TypeScript and production builds of neutral and synthetic configured source.
- Initialization of an empty isolated local D1 database from the tracked schema.
- PowerShell installer parsing and synthetic hidden-launcher execution. Both
  wrappers returned the child script's expected exit code to the caller.
- Packager acceptance of neutral committed source and rejection of configured
  Site identities, credential XML, and committed build-cache files.
- Source and ZIP scans for original owner settings, credential-like strings,
  database files, runtime state, and legacy desktop maintenance material.

The app, schema, and app tests match the current personal source after replacing
owner-specific defaults with public examples. The public starter retains its
own Git history; no private repository history was merged. Each release ZIP
records its public source commit in `STARTER-PROVENANCE.json`, and the builder
emits a companion SHA-256 checksum. Example values must be configured for hosting.

Earlier local browser/API/MCP checks of the integrated application used synthetic
tasks, including replies and preservation of earlier results. Those are prior
application checks, not a second independently hosted deployment of this release.

## Still unverified

A fresh independently hosted deployment, actual installation across devices,
every third-party agent client, and unattended agent checks with the source
computer off have not been established. Synthetic launcher checks do not prove
Windows sign-in behavior on another person's computer. A local task-interface
test does not establish access to transcripts, local files, or external services.

This release is an agent-assisted source/setup package. It does not provide a
one-click executable installer, automatic account provisioning, offline editing,
a shared public service, or first-time Windows sync credential setup. Each user
needs their own private Site, database, authorized agent, and service connections.

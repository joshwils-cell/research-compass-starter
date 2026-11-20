# Changelog

## Unreleased

- Added optional Auto, Local, and Cloud execution preferences for Kai tasks.
- Added project default GitHub repository URLs and task overrides, with manual
  URL fallback and explicit unresolved cloud targets.
- Exposed additive execution metadata in the version-1 hosted task interface.
- Preserved neutral defaults, existing task history, claims, dates, and permissions.
- Live repository/environment discovery and job launching are not included.

## v0.2.0 — November 19, 2026

- Added phone/browser Back and Forward navigation for project views using normal browser history; the blue return button uses the same history.
- Updated README and setup-guide downloads to the packaged v0.2.0 release.
- Made the project-list return button blue, with white text and a darker hover state.
- Added bottom project-list return navigation and month/week/day calendar views.
- Kept scheduled actions distinct from task/independent due dates; added recoverable
  independent entry deletion, date history, stale-write guards, and isolated checks.
- Retained neutral defaults, unset hosting identity, MIT license and separate history.

## v0.1.1 — November 16, 2026

- Added a guided Codex setup prompt and public-repository instructions for
  creating an independent owner-private Sites deployment.
- Added hidden Windows launchers for optional catalog sync and manual refresh,
  with corresponding installer updates. Existing connections are still required.
- Clarified the fixed Eastern timezone, agent labels, separate recurring-check
  setup, and the checks needed before using real work.
- Expanded configuration checks and release exclusions. The ZIP builder now
  emits a SHA-256 checksum alongside the download.

This remains an agent-assisted source package. An independent hosted deployment
has not yet been verified. No personal workspace, credentials, private history,
or legacy desktop database backup helper is distributed.

## v0.1.0

Initial MIT-licensed public starter with neutral deployment settings,
independent-copy configuration, tests, and downloadable source packaging.

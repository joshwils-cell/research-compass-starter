# Verification and limits

The integrated web application underlying this starter passed 33 automated app tests covering tasks, claims, reconciliation, reviewed results, dates, the Codex catalog, and task ordering. Two additional tests cover independent-copy configuration and rejection of already-bound Site identities.

The maintainer also verified a locked dependency installation, TypeScript, a production build, and initialization of an empty local D1 database. Local browser/API/MCP checks used synthetic tasks, including replies and preservation of earlier results.

The public starter passed a clean locked installation, all 33 app tests and two configuration tests, TypeScript, a production build with an unset Site identity, and initialization of an empty local D1 database. The source and release package were checked for original owner settings and credential-like strings. Its example defaults must be replaced for real hosting. No private production data, credentials, or migration record is included.

Not yet established: a second real independently hosted deployment, every third-party agent client, actual device installation across browsers, or unattended scheduled agent execution with the source computer off. A successful local task-interface check does not establish access to transcripts, local files, or external services.

The package is an agent-assisted setup starter. It is not a one-click executable installer, an automatic cloud-provisioning wizard, an offline app, or a shared public service.

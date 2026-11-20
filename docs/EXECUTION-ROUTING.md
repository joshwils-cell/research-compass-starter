# Execution preferences

Tasks assigned to Kai may save Auto (default), Codex Local · This computer, or
Codex Cloud · GitHub. Assignee remains separate. Existing tasks without a route
behave as Auto and keep older task-text routing. Auto lets the connected agent
handle ordinary work directly; Local requires the connected computer and existing
project, with no silent cloud fallback. The labels do not bundle an agent.

Cloud tasks accept a GitHub repository URL. An optional project default is copied
into new cloud tasks; changing it does not retarget existing tasks. Each task can
override or clear the URL, and unconfigured cloud tasks can still be saved.
Repository changes clear a stale environment reference. Non-Kai tasks retain
inactive execution metadata.

There is no live repository or Codex environment lookup in this source update.
The manual URL fallback shows Not verified or Repository needed. Before a launch,
your connected agent must verify repository identity/access and matching saved
environments through its own supported access. A confirmed zero-match lookup
needs cloud setup; multiple matches require an explicit choice. Saved identifiers
are references, not readiness proof. Resolve conflicting owner intent first.

Saving a selection never launches Codex, changes ownership, claims or schedules,
or authorizes publishing, email, a push or a pull request. Existing IDs, results,
reviews, draft references, revisions and both task arrays are preserved.

The optional WorkItem.execution stores route, repository URL/fullName/optional ID,
and optional environmentId. LocalProject.defaultCloudRepository stores the same
repository shape. The version-1 task interface adds an execution summary to all
task lists, ready queues and detail responses. Old clients remain compatible.
No SQL migration, connector permission, credential or automation change is needed.

## Isolated checks

Run the app tests, neutral-copy configuration tests, TypeScript and build from
the README. For the D1/API/MCP rehearsal, initialize a NEW local database under
.wrangler/execution-qa using deployment/local-d1.example.json and the existing
drizzle SQL, always with --local. Start the built Worker on 127.0.0.1:8787 with
that same --persist-to directory, then run node tests/calendar-preview.mjs and
node tests/execution-local.mjs. The scripts accept loopback only. Never use a
real workspace or remote database for fixtures.

At http://127.0.0.1:5174/signin-with-chatgpt?return_to=/, change only the queued
review task's execution to Local. Create a Kai Cloud task named Browser cloud
default using the preselected URL. Change the project default to
https://github.com/example/changed-default and confirm the saved task still uses
the original URL after reload. Override that task with
https://github.com/example/mobile-override. Create Browser unconfigured cloud
and clear its URL. Edit legacy task notes without touching Execution. Verify
non-Kai controls and mobile Back/Forward/footer navigation, then run
node tests/execution-browser-verify.mjs for read-only persistence assertions.

Resolver fixtures cover unavailable, zero, one and multiple environment matches.
They do not establish live discovery, real launches, independent hosted setup,
physical-phone behavior or unattended agent execution.

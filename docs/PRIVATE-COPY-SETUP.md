# Give each person their own private Research Compass

## The intended experience

A person downloads a starter, creates a private copy in their own hosting
account, and connects their own AI agent. They can then add a phone or desktop
icon for that copy. Their work stays in their own database. The project maintainer does not
operate a central service, collect passwords, or manage their account.

The supplied ZIP is a **source/setup package**. It is not a signed Windows/Mac
installer and it does not purchase hosting, create an account, or configure a
cloud service automatically. A host account and a capable setup agent/developer
are still required. The app code is complete; automated provisioning for an
unassisted, one-click installation has not been implemented or tested.

The primary route below keeps each copy private and hosted. That supports phone
access and an agent checking the workspace while the user's computer is off.
The optional Codex catalog refresher still needs its source computer running.

## What the starter contains

`Research-Compass-Starter.zip` contains the latest committed app,
the lockfile, tests, icons, database schema, and these instructions. Its Site ID
is unset and owner URLs/email defaults are replaced with example values. It
contains no installed dependencies, database exports, access tokens, stored
projects, credentials, agent schedules, or Git history.

Unzip it into a new folder and open that folder in Codex. Begin with
`PRIVATE-COPY-START-HERE.md` and its copyable setup prompt. Use an empty
folder and a new private deployment; do not unzip over a working installation.

## Set up a new independent private copy

1. **Use your own hosting account.** The current integration targets ChatGPT
   Sites. A setup agent needs the Sites tools, or equivalent provisioning access
   in your environment. Having an arbitrary AI chat subscription does not by
   itself establish that access. If those tools are unavailable, use the
   other-host engineering route below; this ZIP cannot supply a missing hosting
   capability.
2. **Create one new private Site and a fresh database.** Retain the exact Site
   ID and HTTPS URL returned by the host. Leave the audience owner-only. Do not
   reuse any ID, database, OAuth client, plugin connection, token, or account from
   another installation. If registration already succeeded, reuse that
   new Site rather than registering it twice.
3. **Configure this source copy** with the values for the newly created Site:

   ```powershell
   node scripts/configure-private-copy.mjs --site-id YOUR_NEW_SITE_ID --site-url https://YOUR-NEW-PRIVATE-SITE --email YOUR_EMAIL
   npm run install:ci
   ```

   Replace every example argument. The script rejects a source copy already
   bound to a Site. It updates the neutral starter's Site binding, installation
   link, optional sync endpoints, and email defaults. It does not deploy or
   contact any service. The email is a task default, not a credential or an
   authorization to access the account.
4. **Run the checks and build**, using the README commands. For local testing,
   initialize the empty local D1 database first. Local data is separate from the
   hosted database.
5. **Publish through the host's normal source workflow.** Bring the configured
   source into the new Site's authorized source repository, keeping its identity
   and `DB` binding. Apply the tracked schema to the new hosted D1 database using
   the host's migration process. Build/package the Worker from that exact source
   commit, publish to the new private Site, and wait for a successful deployment.
   GitHub upload alone does not deploy or initialize a database.

   The setup agent should use the current Sites skill for source access,
   migration, packaging, and private publication. Retain the source credential
   returned at registration and keep credentials in memory/stdin. Configure the
   neutral downloaded copy before transferring it into the new Site's checkout;
   the configuration helper deliberately refuses an already-bound source copy.
   Preserve the new checkout's Site ID, `DB` binding, and MCP declaration. Do not
   run a default starter generator over the Research Compass application.
6. **Verify a genuinely empty workspace** in your own account. Create a sample
   project and a task, refresh, and confirm they persist. Sign out and confirm
   private records are inaccessible without sign-in. Use the actual new URL on
   a second device. No personal project-data import is necessary to start fresh.

If the same owner wants to restore their own backup, use Settings → Restore only
after testing, into an empty workspace. A new recipient should never import
another person's backup. Do not add private backup JSON to a code repository or ZIP.

### Prompt to give Codex

Copy the full prompt from [PRIVATE-COPY-START-HERE.md](../PRIVATE-COPY-START-HERE.md).
It covers the same sequence, including checking for Sites access before creating
anything. Keep that file open if setup is interrupted so the agent can resume
with the Site identity it already received.

## Connect the person's own AI agent

The hosted app exposes `/mcp` with task and activity tools. Connect the new Site's
own provisioned Research Compass plugin in that person's agent environment and
complete its normal authorization flow. A different user must not reuse another person's
connection or bearer token. For another MCP-capable agent, configure the new
deployment's supported endpoint and authentication; compatibility must be tested
with that particular client.

The UI names Kai and Codex are fixed labels. A person can use the Kai assignment
for their connected assistant; it is not a built-in agent included in the ZIP.
Changing these labels into configurable agent names would be a later improvement.
An agent must have its own access to any files or services required for a task.
No model calls are made by the project/task interface itself.

Test the connection with a harmless synthetic task. Ask the agent to list its
ready work, claim the test task, record a result, and leave it Awaiting review.
Reply in the app and request changes; confirm the ready task includes that reply
and the previously reviewed result. Confirm that a subsequent result preserves
the earlier history. Email tasks create unsent drafts and never send because of
an approval button alone.

Dates and times use `America/New_York`, including daylight saving time. This
release keeps that timezone and the Kai/Codex labels fixed.

If the agent supports scheduled checks, the person sets up a schedule in their
own agent service after the synthetic task flow works. The ZIP does not create
one. For Codex, an example separate request is: "Check my Research Compass for
ready tasks assigned to Codex every 30 minutes." Ask Codex to confirm the actual
schedule and execution environment it configured. A suitable task instruction is:

> Review Research Compass for context. Work only on active, ready tasks assigned
> to your label. Read userResponse and executionGuidance before continuing a
> reviewed task. Claim before execution and begin before external actions.
> Reconcile started or uncertain attempts. Inspect/reuse existing draft IDs for
> revisions. Record results and await review when appropriate. Do not send email
> or messages without the owner's separate authorization.

To establish computer-off operation, test the actual scheduled run while the
computer is off and inspect the saved result. A manual task-interface test does
not establish unattended agent execution or access to local files/transcripts.

## Install the app icon

Once the person's new private HTTPS app is working, open that URL in their
regular browser and sign in. Use the browser's Install app/Add to home screen
option when available. On iPhone/iPad, use Safari's Share → Add to Home Screen.
On desktop, use the browser's install option or app shortcut feature. Test the
actual device/browser, including reopening the icon and signing back in.

The app already includes a web manifest and 192/512-pixel icons. Browser menu
installation and in-page install prompts have different requirements, so the
in-page button is not guaranteed to appear on every browser. Installation still
opens that person's hosted copy. It does not download a private server, enable
offline editing, or make local computer files available to an agent.

Source: [Chrome's installation guidance](https://developer.chrome.com/blog/update-install-criteria)
and [MDN's installable web app guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

## Optional Codex catalog sync

Start without catalog sync; project/task editing and the agent task interface do
not require it. For a new installation, review `CODEX-CATALOG.md` and configure
that person's computer, their new Site URL, a new sync secret, and their own
private service access. The configuration helper rewrites source endpoints; it
does not install helpers, create credentials, or authorize a scheduled task.

The current Windows installers assume an existing connection file and are
maintenance scripts, not a new-user wizard. They store credentials with Windows
DPAPI for the current Windows user. Do not distribute an installed user's XML
credential file. Helpers read project/chat list metadata, not transcripts or
source files, and cannot refresh from a powered-off source computer.

Both installers now use hidden WScript launchers. Once set up, they do not
require a minimized PowerShell window. Installing these helpers does not create
or change a recurring agent check. First-time Windows credential provisioning
is not part of the guided setup in this release.

## Other private hosts and computer-only installers

Running the current build on an arbitrary host is not a complete private-copy
setup. Authentication reads Sites-supplied identity headers, and all authenticated
requests address a single D1 workspace. Outside the trusted Sites gateway, do
not trust identity headers supplied by a browser. Replace authentication with a
verified session/OAuth implementation or a trusted private gateway, secure all
HTTP/MCP routes, and provision a new database. Connector context and sign-in
paths also need host-specific replacements. Merely changing a domain or Worker
name does not make that port ready.

For a direct Cloudflare Worker port, an implementer would also need to replace
Sites-specific build/hosting metadata and configure the person's Worker, D1
binding, secrets, and migration path. Set `migrations_dir` to `drizzle` or otherwise
explicitly map the tracked migration files. After the port is implemented, use
local migrations for rehearsal and remote migrations only against that person's
new database. A generic Deploy to Cloudflare button should be added only after
this path is tested, not presented as working for this Sites snapshot.

References: [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/),
[Cloudflare deployment buttons](https://developers.cloudflare.com/workers/platform/deploy-buttons/),
and [Vinext deployment documentation](https://github.com/cloudflare/vinext).
This repository pins an older Vinext version; newer upstream CLI examples must
not be substituted for this lockfile without a separate tested upgrade.

A computer-only installer would need a packaged runtime, local database, and a
secured local agent connection. The current web snapshot does not include that
installer. It would generally require the computer to be on for remote access
unless a separate hosted service were added. The older Electron repository is
a separate application; it does not include the latest web updates automatically.

Neither option requires the maintainer to run a shared public service. The private-hosted
starter is the closer fit for the current app; a signed, one-click installer and
an account-provisioning wizard are future packaging work.

## Maintainer distribution process

This public starter uses the MIT license. Keep configured deployments and their
private data in the recipient’s own account and private working repository. To prepare a starter from reviewed, committed source:

```powershell
python scripts/package-private-copy.py
```

The builder copies committed files only, refuses a configured Site identity,
excludes runtime/private files, and checks the resulting ZIP. Extract and test
the ZIP in a fresh directory, review it for private material, and record which
checks actually passed. Keep independent hosted deployment marked unverified
until it is tested in another installation. Retain the application MIT license and the included third-party
license notices. No one-click independent cloud deployment was performed as
part of creating this repository and starter.

# Research Compass Starter

Create your own private research workspace and connect your own AI agent.

Research Compass keeps projects and next steps together, including dated tasks, agent assignments, results, and your review responses. This is a public source starter under the [MIT license](LICENSE). **Every user deploys a separate private app in their own hosting account.** No shared service or user-account management is provided by this repository.

## Start here

- [Download v0.1.1](https://github.com/joshwils-cell/research-compass-starter/releases/tag/v0.1.1) and choose **Research-Compass-Starter.zip** under Assets.
- [Set up your private copy](docs/PRIVATE-COPY-SETUP.md)
- [Read the verification limits](VERIFICATION.md)

Unzip into a new folder, open that folder in Codex, and paste the setup prompt
in [PRIVATE-COPY-START-HERE.md](PRIVATE-COPY-START-HERE.md). Codex first checks
for Sites access, then helps configure, test, and publish your own private copy.
After publication, connect your own agent and test a sample task. You can request
recurring checks separately once that connection works.

**This is an agent-assisted source/setup package, not a one-click executable installer.** You need your own private hosting account, an empty database, and an agent/developer capable of setting up the deployment. Current integration targets Sites and Cloudflare D1. Access to the needed hosting tools depends on your environment. Other hosting providers require an authentication/deployment port; uploading the build alone is insufficient.

The hosted approach supports phone access and an agent reading saved tasks while your source computer is off. Local files and Codex metadata refresh still depend on that source computer being available. Installing an app icon does not install a backend or add offline editing.

## What it does

- Organizes existing and new projects alphabetically.
- Combines work in one Next steps list, preserving former follow-ups and their details.
- Supports notes, completion, archiving, assignments, and optional Eastern dates/times.
- Gathers tasks across projects in Assigned work.
- Shows agent results and lets you Request changes, Approve and continue, or Approve and finish. Your responses and copies of reviewed results stay in the history.
- Makes continuations ready for your agent's next check. It does not launch an agent or create a schedule.
- Exposes an authenticated MCP task/activity interface for your own agent connection.
- Offers full workspace backup/restore and optional Codex project/chat metadata references.

Kai and Codex are assignment labels, not agents bundled with the code. Connect your own agent and any services it needs. Email review actions do not send email; drafting requires your own authorized mail connection.

Dates and times use `America/New_York`, including daylight saving time. Agent
labels and this timezone remain fixed defaults in this release.

## What you need

| Requirement | Purpose |
| --- | --- |
| Node.js 22.13+, npm, and Git | Install dependencies, run tests, and build |
| Your own private hosting account and database | Keep your workspace available across devices |
| Sites setup tools or a qualified implementation of another host | Provision private authentication, hosting, and the database |
| Your own MCP-capable agent and service connections | Read tasks and perform authorized work |
| Python 3.12+ (maintainers only) | Build release ZIPs |

No model API key is required to run the project/task interface. Actual agent work may depend on your agent service, account access, and its own costs. The source starter contains no hosting credentials, agent subscription, live database, stored projects, Gmail drafts, or AI-agent schedule.

## Configure an independent hosted copy

Create one new private Site and database in your own account using your host's provisioning tools. Keep the exact new ID and HTTPS URL it returns. Reuse that new Site if registration already succeeded; do not create a duplicate. Then run:

```powershell
git clone https://github.com/joshwils-cell/research-compass-starter.git
cd research-compass-starter
node scripts/configure-private-copy.mjs --site-id YOUR_NEW_SITE_ID --site-url https://YOUR-NEW-PRIVATE-SITE --email YOUR_EMAIL
npm run install:ci
```

Replace every example value. The helper updates this unbound source copy's Site identity, installation URL, optional sync endpoints, and email defaults. It does not contact a service, create credentials, or deploy. Publish through your new Site's authenticated source/migration workflow. The [setup guide](docs/PRIVATE-COPY-SETUP.md) has the full sequence and a prompt for a setup agent.

The committed `.openai/hosting.json` has `project_id: null`. Addresses and URLs in the starter are examples. Configure them before a hosted deployment. Each installation should use its own database, sign-in, plugin connection, secrets, and backups.

## Local development

For an isolated local preview, configuration of a hosted Site is not necessary:

```powershell
npm run install:ci
npx wrangler d1 execute DB --config deployment/local-d1.example.json --local --persist-to .wrangler/state --file drizzle/0000_nice_the_initiative.sql
npm run dev
```

Run the initial CREATE TABLE script only once against an empty local database. Local test data stays under ignored `.wrangler/` and `.sites-runtime/` directories.

Open the loopback URL printed by the server, normally `http://127.0.0.1:5173/`. The development server simulates sign-in as `seedy@sites.test`. If necessary, open `/signin-with-chatgpt?return_to=/` on that local URL. Keep development on loopback. This mock sign-in is not a production authentication system.

## Tests and production build

```powershell
node --import tsx --test tests/*.test.ts
node --test tests/private-copy-setup.test.mjs
node node_modules/typescript/bin/tsc --noEmit
npm run build
```

Use the committed lockfile. The app uses React, Vinext, a Cloudflare Worker, and D1. A build produces the Worker under `dist/server/`; it does not publish. `npm start` previews the built Worker without the dev server's mock sign-in or the hosted sign-in service. GitHub pushes do not deploy an app.

The four configuration tests validate an unbound public starter and skip once
the source has a Site identity. Run them before configuration when checking a
download. The 33 app tests also run against a configured copy.

The original integrated web application passed local browser/API/agent-interface checks. This starter also has configuration tests. A fresh, independently hosted deployment by another user has not yet been verified. Do not treat these checks as proof that every agent, host, or browser installation will work without setup.

## Privacy, backups, and updates

All authenticated requests address one workspace in this version. It is designed for one owner per private deployment, not a shared public service with isolated user accounts. Production authentication trusts identity supplied by the Sites gateway. Another host must replace or securely reproduce that trusted boundary; do not accept identity headers from an untrusted browser.

Use Settings → Download full backup and store the JSON privately outside Git. It contains project/task records, replies, reviewed results, activity, and context metadata. Restore requires an empty workspace and does not recover external service accounts or schedules. Export before schema changes. Reverting source does not revert database records.

After configuring a deployment, keep its working copy and deployment identity in your own private repository. Do not push personal configuration or database exports back into this public starter. Review upstream changes and test against an isolated database before updating your copy.

## Release packaging and license

Maintainers can create a ZIP from committed, unconfigured source:

```powershell
python scripts/package-private-copy.py
```

The builder refuses configured Site identities and excludes runtime files. ZIPs are written under ignored `outputs/`. See [third-party notices](THIRD-PARTY-NOTICES.md) for retained upstream licenses.

Copyright (c) 2026 Joshua Wilson. Application code is available under the [MIT license](LICENSE). Included third-party material retains its own notices. This starter has no automatic connection to an existing user's workspace, deployment, or credentials.

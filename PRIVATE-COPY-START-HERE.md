# Set up your own private Research Compass

1. Download **Research-Compass-Starter.zip** from the
   [v0.1.1 release](https://github.com/joshwils-cell/research-compass-starter/releases/tag/v0.1.1).
2. Extract it into a new folder and open that folder as a project in Codex.
3. Paste the prompt below into a new chat in that project. Give Codex your own
   email address when it needs the task email default; do not paste passwords or tokens.
4. Follow the account's normal authorization prompts. After publication, use
   your own private URL and connect your own agent.

## Prompt for Codex

```text
Set up this Research Compass starter as my own private Codex Sites app.
Read AGENTS.md and docs/PRIVATE-COPY-SETUP.md, and use the current Sites skill.
First check that Sites provisioning, private publishing, and source tools are
available. If they are missing, explain what access I need and stop before
creating a deployment. Do not substitute a public app or another owner's Site.

Create one owner-private Site with its own empty D1 database. Retain the returned
Site ID, URL, and source access; reuse that Site if registration already succeeded.
Configure an untouched neutral copy with scripts/configure-private-copy.mjs using
that ID, URL, and my email default. Bring the configured source into the new
Site's authorized checkout, preserving its identity, DB binding, and MCP support.
Do not replace this app with a default starter or copy anyone else's data or keys.

Install the locked dependencies, initialize an isolated local database, run the
app and configuration tests, check TypeScript, and build. Apply the tracked schema
only to my new empty hosted database through the current Sites migration process.
Publish the exact tested source privately using the Sites source and publication
workflow, and wait for a successful deployment. Keep credentials out of files,
commands, Git, and output; use the supported in-memory/stdin credential workflow.

Verify that the new workspace starts empty, that a synthetic project and task
persist after refresh, and that unauthenticated access cannot read private records.
Help me connect this Site's own Research Compass plugin, then test listing,
claiming, recording a result, and responding to a review using a sample task.
Keep my configured source in a private working copy. Report the private URL,
what passed, and any checks that still need me or another device.
Leave optional Windows catalog helpers and recurring Codex checks unconfigured
unless I separately request them. Do not send email or messages.
```

The [full setup guide](docs/PRIVATE-COPY-SETUP.md) explains the commands, agent
connection, app icon installation, and optional catalog sync.

This public MIT-licensed source starter has an unset Site identity and example-only URLs/email defaults. It includes no live workspace records, tokens, dependencies, or agent subscription. You need your own private hosting account/database and agent connection. Setup is agent-assisted; this is not a one-click executable installer.

Do not publish a configured copy or private backups back into this public repository. Your deployed app should remain private in your own account.

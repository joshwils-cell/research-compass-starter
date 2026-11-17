# Calendar and project navigation

Use **Calendar view** in the top navigation. Switch between Month, Week, and
Day; use Today, previous/next, or Go to date. Select a month date to open its
day. Week/day separate All day entries from timed entries. Times mark a task
or entry's start/deadline; no duration is inferred. On phones, month/week
scroll horizontally inside the calendar; day fits the screen. The scroll area
is keyboard focusable, and buttons and event types have text labels.

Existing **Act on** dates appear as **Scheduled action**. A task can also have
an independent **Due date**, set through Edit step. Due dates never affect agent
readiness. Select a task's calendar entry to change its date/time or open its
project. Both original `steps` and `followUps` remain in their original arrays.
Completed/archived tasks and archived projects leave the calendar and remain
accessible in their projects. Unarchiving/reopening shows their dates again.

**New entry** creates an independent scheduled action or due date without a
project. Delete entry moves it to **Deleted independent entries**, where Restore
keeps the same ID. Archive task is reversible in the project's Archived steps.
Remove this date clears just the selected task date; the task remains. Date
changes retain the previous and new date/time in task activity so they can be
re-entered. A **Back to projects list** button follows the task list, including
its completed/archived sections; returning scrolls to and focuses the list heading.

All dates/times use America/New_York, regardless of the browser timezone.
The nonexistent spring hour is rejected. The first occurrence of the repeated
fall hour is used. Calendar entries do not launch agents, send messages, create
reminders, sync with Google Calendar, or change any external schedule.

## Data compatibility

No SQL migration or existing-record rewrite is needed. Optional task `dueDate`
and `dueTime` fields extend the existing records. Independent entries use the
new `setting:calendar-v1` record, created only after an explicit owner save.
Existing projects, revisions, claims, reviews, results, links and states remain
in place. Task events are derived from their original records rather than copied
to another table. Composite event keys include project, array, task and date type.

Project revisions, calendar revision checks, and the existing atomic D1 workspace
guard reject stale or concurrent writes. Backups include the calendar setting,
including deleted entries; restore into an empty workspace validates it. Older
backups simply start with an empty independent calendar. Always retain a current
private backup before data/schema changes. Source rollback does not undo data.

## Isolated checks

Run the README app tests, TypeScript and build. `tests/calendar.test.ts` covers
calendar identity, both arrays, preservation, rescheduling/deletion/restoration,
stale writes, civil date arithmetic, leap years, DST, readiness and named controls.

For opt-in HTTP integration checks, initialize a **new** local database path:

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --config deployment/local-d1.example.json --local --persist-to .wrangler/calendar-test --file drizzle/0000_nice_the_initiative.sql
$env:COMPASS_LOCAL_STATE='.wrangler/calendar-test'
npm run dev -- --host 127.0.0.1
# In a second terminal:
node tests/calendar-local.mjs http://127.0.0.1:5173
```

The script refuses non-loopback URLs and nonempty workspaces, tests HTTP/D1
persistence, revision races, authorization and backup inclusion, then leaves
only synthetic records for browser checks. Use another NEW path for another run.
Never use production data or production fixture scripts.

If the development dependency optimizer fails, test the built Worker instead:

```powershell
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js dev --config dist/server/wrangler.json --local --persist-to .wrangler/calendar-test --ip 127.0.0.1 --port 8787 --inspector-port 0
# In another terminal, start the loopback-only synthetic sign-in gateway:
node tests/calendar-preview.mjs
```

Open `http://127.0.0.1:5174/signin-with-chatgpt?return_to=/` for browser checks.
The opt-in API script also accepts this gateway, provided its database is empty.
This gateway is test tooling only; production continues to use Sites sign-in.

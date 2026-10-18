# Pielgrzym: project map and operating constraints

This is the project-specific context for coding agents. Keep it synchronized with behavior changes.
Use this map to locate the relevant implementation, not as a substitute for checking code that has changed since this document.

## Language and comments

- Write source code identifiers, internal logs, developer-facing errors, and all documentation in grammatically correct English.
- Write every bot-authored Discord message in Polish, including public and ephemeral replies, errors, embeds, labels,
  placeholders, permission names, command descriptions, and counter channel names.
- Keep slash command, subcommand, and option identifiers in English. Keep machine-readable choice values and component IDs stable;
  their displayed labels must be Polish.
- Preserve user-provided text, external content, usernames, URLs, product names, and API identifiers without translation.
  For example, `/echo` forwards the user's text and YouTube notifications retain the original video titles and comments.
- Keep code comments short and simple, on a single line, starting with a capital letter and without a trailing period.
  Use `//` for JavaScript comments; do not add block comments or narrate self-explanatory code.

## Purpose and runtime

- Single-process Discord bot for zbawienie.pl and zasobybiblijne.org. Bot-authored user-facing messages are Polish.
- CommonJS JavaScript, Node.js >= 24, pnpm >= 11; package manager pinned in `package.json`.
- No transpilation, framework, database server, HTTP server, or build step.
- `discord.js` 14 handles Discord; the client subscribes only to `GatewayIntentBits.Guilds`.
- `node-cron` 4 is an npm dependency running inside the bot process, NOT a built-in Node.js module or operating-system cron.
- YouTube uses native `fetch` against `https://www.googleapis.com/youtube/v3/`. Do not restore `googleapis`,
  `node-fetch`, deprecated transitive packages, or dependency overrides merely to implement these public reads.
- Public YouTube data requires `YOUTUBE_API_KEY`, not OAuth. Enable YouTube Data API v3 in the Google Cloud project.
- `bufferutil` is retained as an optional Discord performance optimization, with its build explicitly allowed.
  `zlib-sync` is deliberately absent: discord.js automatically disables gateway transport compression without it.
  This removes that C++ build requirement at the cost of increased bandwidth. Do not invent an unsupported `ws.compression` option.

## Entry points and structure

| Location                                                      | Responsibility                                                                                            |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `index.js`                                                    | Load dotenv, enable colored logging, create the Discord client, load handlers, log in.                    |
| `handlers/commands.js`                                        | Load `commands/<group>/*.js` into `client.commands` when exports contain `data` and `execute`.            |
| `handlers/events.js`                                          | Register `events/*.js` using their `name`, `once`, and `execute` exports.                                 |
| `events/interaction-create.js`                                | Dispatch channel-select components and slash commands; check bot permissions and report command failures. |
| `events/ready.js`                                             | Register all recurring YouTube jobs once after Discord becomes ready.                                     |
| `events/guild-create.js`, `events/guild-delete.js`            | Initialize/remove guild configuration on membership changes.                                              |
| `commands/utility/`                                           | About, echo, info, invite, ping, reaction management, support.                                            |
| `commands/youtube/index.js`                                   | Slash-command definition/router; restrict management to administrators or configured owner.               |
| `commands/youtube/enable.js`                                  | Resolve handle, then legacy username; save channel/setup date and populate uploads cache.                 |
| `commands/youtube/{disable,counter,settings,status,check}.js` | Disable monitoring/counters, configure channels, display state, request immediate checks.                 |
| `handlers/interactions/channel-select.js`                     | Route channel-select callbacks registered by settings UI.                                                 |
| `config/youtube.js`                                           | Shared API adapter, enabled-monitoring configuration, uploads-playlist ID derivation.                     |
| `services/yt-videos-cache.js`                                 | Download all pages of the uploads playlist and replace the guild's cached videos.                         |
| `services/yt-videos-monitor.js`                               | Detect new uploads, notify Discord, increment local video count, schedule post-publication statistics.    |
| `services/yt-comments-monitor.js`                             | Scan recent/priority videos, diagnose old videos, fetch replies, deduplicate, format notifications.       |
| `services/yt-subs-counter-monitor.js`                         | Fetch/store channel statistics and update the subscriber voice channel.                                   |
| `services/yt-views-counter-monitor.js`                        | Maintain view-count history and derive the displayed annual/estimated count.                              |
| `services/yt-videos-counter-monitor.js`                       | Update the video-count voice channel from channel statistics.                                             |
| `utils/guild-config.js`                                       | Guild configuration persistence, enable/disable, serialized JSON writes.                                  |
| `utils/yt-cache.js`                                           | Video/comment cache persistence, normalization, metadata merging, serialized JSON writes.                 |
| `utils/yt-task.js`                                            | Serialize monitoring/cache/statistics work for the same guild; different guilds can run independently.    |
| `utils/format-number.js`                                      | Spaced numbers and Polish compact suffixes.                                                               |
| `utils/permissions.js`                                        | Shared command permission definitions.                                                                    |
| `deploy-commands.js`                                          | Register guild/global commands or clear registrations; not part of normal startup.                        |
| `ecosystem.config.js`, `run.sh`                               | Single-instance PM2 deployment; pull, select Node, install, deploy commands, restart/start.               |
| `data/`, `logs/`, `.env`                                      | Local runtime state/secrets; ignored by Git. Never expose their contents.                                 |
| `images/`                                                     | Bot imagery.                                                                                              |

## Commands and development workflow

```sh
pnpm install
pnpm start
pnpm deploy:guild
pnpm deploy:global
pnpm deploy:clear
pnpm validate
```

- `start` runs nodemon; there is no `dev` script. Nodemon ignores `data/*` and `logs/*`.
- Production uses `bash ./run.sh`, nvm, and PM2. Keep `instances: 1`.
- `.env.example` documents Discord client/token/owner/guild identifiers and `YOUTUBE_API_KEY`.
  Do not read real `.env` values into chat, logs, fixtures, or documentation.
- Slash-command modules export `permissions`, `data` (`SlashCommandBuilder`), and `execute`.
  UI settings use Discord Components V2 and ephemeral replies, with dynamically registered select handlers.
- Format with existing Prettier configuration: no semicolons, single quotes, two spaces, LF, 150-column width.
  ESLint uses flat config, recommended JavaScript/Node rules and Prettier.
- There are intentionally no repository test files or `test` script, per owner request.
  Validate changes using `pnpm validate`, syntax checks, and isolated mocked verification as appropriate.
  Never start the live bot, consume real API quota, deploy slash commands, or mutate runtime data merely to validate code.
- No dependency additions are needed for the scheduler implementation.
- `pnpm-workspace.yaml` currently only allows the `bufferutil` build; it does not set `storeDir`.
  Cross-drive pnpm store warnings are machine configuration issues. Do not claim this checkout fixes them.
- pnpm generates its own lockfile formatting; Prettier may rewrite it after an update. Never edit package resolutions manually.

## Data model and write safety

`data/guild-config.min.json` is keyed by guild ID:

- Guild metadata and `ytMonitoring.enabled`.
- `ytMonitoring.setupDate`: baseline for suppressing pre-setup notifications.
- `ytMonitoring.youtubeChannel`: channel ID, snippet, statistics.
- `ytMonitoring.notifications`: `newVideosChannelId`, `activityChannelId`.
- `ytMonitoring.counters`: `subsChannelId`, `viewsChannelId`, `videosChannelId`, optional `viewsHistory`.

`data/yt-cache.min.json` is keyed by guild ID:

- `videosCache`: newest-first array of `{ id, snippet }`; the ID is a VIDEO ID, not a playlist-item ID.
- `seenComments`: up to 10,000 IDs, retaining the newest encountered IDs.
- `videosMeta`: map of video ID to `{ commentCount, lastCommentId }` for old-video diagnostics.

Both existing JSON stores also serialize writes and use temporary-file/rename replacement.
Queues and monitoring locks are in-memory and process-local: they are NOT distributed locks.
Preserve one instance and persistent `data/` across deployments.
Read-modify-write callers outside monitoring can still overwrite stale configuration; queueing a write is not a transaction.
Disabling monitoring clears the guild's YouTube cache.

## YouTube adapter contract

- Exposes `youtube.channels.list`, `playlistItems.list`, `videos.list`, `commentThreads.list`, `comments.list`.
- Parameters are encoded using `URLSearchParams`; arrays become comma-separated values; `null`/`undefined` are omitted.
  Omission matters for first-page pagination tokens.
- Returns `{ data: parsedResponse }`, preserving existing consumers and Google response shapes.
- Errors retain HTTP `code`, Google `message`, and `errors[]` (including `reason`) for monitor logic.
  `isQuotaError` recognizes Google's `quotaExceeded`/`dailyLimitExceeded` reasons without changing the HTTP code.
- Each attempt has a 30-second timeout. Retry network errors, 408, 429, and 5xx up to three times after the first attempt,
  with 100/200/400 ms backoff. Authentication, invalid-parameter, and ordinary permission errors are not retried.
- There is no local daily cap, quota ledger, or reservation write before HTTP requests.
- Derive uploads playlist IDs by replacing channel prefix `UC` with `UU`, avoiding `search.list`.
- Use `contentDetails.videoPublishedAt` before playlist snippet timestamps; playlist insertion time is not publication time.

## Scheduling and concurrency

All cron expressions use `America/Los_Angeles`, including DST. Jobs are registered in-process on `ClientReady`.
`noOverlap: true` prevents a job from stacking another instance of itself; it skips a tick if still running.
`runGuildTask` additionally serializes different monitoring jobs and cache refreshes for the same guild.
Service public entry points own their locks; do not wrap them again in the same guild lock (that would deadlock).
The hourly statistics job owns its guild lock directly because counter helpers do not.

| Pacific time                  | Job                   | Work                                                                                           |
| ----------------------------- | --------------------- | ---------------------------------------------------------------------------------------------- |
| `*/10 * * * *`                | New uploads           | Read first uploads page, compare video IDs, notify and schedule summary.                       |
| `*/30 * * * *`                | Active comments       | Scan all videos within the active window.                                                      |
| `0 4 * * *`                   | Full video cache      | Paginate uploads, 50 videos/page, replace cache.                                               |
| `0 9 * * *`                   | Old-video diagnostics | Batch statistics, detect count/latest-ID changes, scan changed videos.                         |
| `0 * * * *`                   | Channel statistics    | Fetch channel statistics once; update subscriber channel if configured.                        |
| Midnight branch of hourly job | Daily counters        | Reuse that same successful statistics refresh for views and videos (`false` refresh argument). |

The guild list is read once per job invocation, not kept in a five-minute stale cache.
Durations are logged in milliseconds. Guilds within a job are processed sequentially, avoiding uncontrolled API bursts.
Failures are logged per guild so one guild's failed statistics request does not abort the rest of that job.
Jobs can be delayed by other work for the same guild; cron expressions are target frequencies, not latency guarantees.
The views/videos daily branch uses the scheduled execution date, not the server's timezone.

The 45-minute-after-publication summary still uses native `setTimeout`, not cron.
It is in-memory and lost on restart; delayed summaries are not persisted or replayed.
If a newly discovered upload is already older than 45 minutes, its summary runs immediately.

## Comment-monitoring algorithm and tradeoffs

- Active means age <= 60 days **OR** position < 100, not the intersection and not a strict maximum of 100.
  A channel publishing more than 100 videos in 60 days increases the active count and quota cost.
- Each active video gets `commentThreads.list(part=snippet,replies, order=time, maxResults=100)`.
- Process top-level comments and included replies. If included replies are incomplete, fetch `comments.list` pages.
- Both thread and reply scans are capped at 10 pages (up to 1,000 items each).
- Stop thread pagination when a page's last top-level ID was already seen before the scan.
  A single shared baseline `Set` is built per guild scan rather than copying up to 10,000 IDs for every video.
- Deduplicate by comment ID, suppress comments before setup, sort notifications oldest-first.
- Old videos first use `videos.list` batches of 50 IDs to compare `commentCount`.
  When counts match, check the newest top-level comment ID to detect replacement/deletion with equal counts.
  Compare `snippet.topLevelComment.id`, NOT the thread resource's `id`.
- Failed/incomplete thread scans do not advance the old-video metadata baseline.
  Google quota errors propagate out of per-video/reply/batch loops so an exhausted quota does not spin through all remaining videos.
- Missing/deleted/private videos can be removed from cached videos; disabled comments are not treated as deleted videos.

Known coverage limits: new replies on old top-level threads beyond the early-exit boundary may be missed;
the 10-page caps are not exhaustive history; unchanged aggregate counts cannot prove that all replies are unchanged.
Do not replace regular comment reads with statistics-only polling and call it equivalent.
Seen IDs are persisted before notification delivery, so failed Discord sends can lose notifications; there is no durable outbox.
A 10,000-ID history is finite and older evicted IDs can be rediscovered. Increasing retention changes disk/CPU costs.
Uploads polling only reads the newest 50 uploads; very large bursts/downtime may leave notification gaps.

## Daily quota: accounting, reset, sizing

All five currently used `list` endpoints cost 1 unit per request/page.
Google's default combined allocation for these endpoints is 10,000 units per project per day.
The owner dedicates this Google Cloud project to this integration and allows using the full Google allocation.
Do not impose a smaller local budget. Google enforces the actual quota; the bot has no local daily counter or blocking ledger.

- Google resets at **00:00 America/Los_Angeles**. This is generally 09:00 in Poland, temporarily 08:00
  while European and US DST transitions differ. Do not encode a fixed Warsaw/UTC reset hour.
- Google quota errors are not retried immediately. The affected scan exits and logs the error.
  Later scheduled runs can try again; normal requests succeed again after Google resets its quota.
- Actual Google quota consumption must be checked in Cloud Console. No automatic Google usage query is implemented.
- Any leftover `data/yt-quota.min.json` from the removed local guard is ignored and requires no migration or manual cleanup.
- Sequential order is not a fairness policy: under multiple guilds or very heavy activity, later work may be starved.

Sizing snapshot from the local dataset on 2026-10-18: **1 enabled guild, 214 cached videos, 100 active, 114 old**.
With every notification and counter enabled, one page per video, no retries/manual activity/new uploads:

| Component                                                                            | Units per ordinary 24-hour day |
| ------------------------------------------------------------------------------------ | -----------------------------: |
| Upload polling, every 10 minutes                                                     |                            144 |
| Active comment polling, 100 videos x 48 runs                                         |                          4,800 |
| Shared hourly channel statistics, including daily counters                           |                             24 |
| Full uploads cache, ceil(214 / 50)                                                   |                              5 |
| Old-video statistics, ceil(114 / 50)                                                 |                              3 |
| Old-video first-page scan or latest-comment check, at most one each in this baseline |                            114 |
| **Baseline total**                                                                   |                      **5,090** |

Before sharing daily statistics the same full-configuration estimate was 5,092.
General baseline: `H * (6 + 2*A + 1) + max(1, ceil(V/50)) + ceil(O/50) + O`,
where H is hours in the Pacific day, V cached videos, A active videos, O old videos.
For this dataset, planning estimates are **4,883 / 5,090 / 5,297** on 23/24/25-hour days, respectively
(assuming every interval fires, including the repeated hour; actual cron/DST/skipped-tick behavior can reduce the count).
The default 10,000 allocation leaves about 4,703 units above the longest-day baseline for additional activity.

Every additional comment/reply page, retry, manual check, channel lookup, and delayed summary adds units.
Ten thread pages for every active video on every poll would alone cost 48,000 units/day, before replies.
Two guilds with this dataset can already exceed 10,000 baseline units if requests are not shared.
Therefore the schedule does NOT guarantee every scan completes within Google's quota during heavy activity.
Do not promise complete scans and an arbitrarily low quota at the same time. Recalculate when videos, guilds, or traffic change.

## Counter semantics and review boundaries

- Hourly statistics refresh is useful even without a subscriber counter: `/youtube status` uses cached statistics.
- Daily views history stores UTC `YYYY-MM-DD` entries, retains roughly 366 days, and clamps negative results to zero.
  Display is lifetime views until sufficient history exists; from 30 days it estimates an annual count;
  with >=365 days it uses a historical baseline. This is not a YouTube Analytics rolling-year query.
- Renaming counters requires ViewChannel, Connect, and ManageChannels. Missing channels/permissions disable counters.
  Skip Discord rename requests when the formatted channel name is already current.
- Video count increments locally on newly detected uploads; daily statistics reconcile it.
- Cache keeps uploads newest-first even though notifications are sent oldest-first; do not reverse the stored array in place.
- The current JSON dataset is small (~336 KB video cache, ~2.8 KB guild config at review time);
  disk/network and sequential API waits matter more than arithmetic. Do not add a database or unbounded concurrency speculatively.

Other pre-existing limitations discovered during review, not silently fixed here:

- Command/config read-modify-write races remain outside the monitoring locks.
- Event loader registration catches do not catch asynchronous event-handler rejections; login has no explicit failure handler.
- `/youtube enable` disables old monitoring before validating the replacement; it assumes a high-resolution channel thumbnail.
- `/info user` can dereference a null member after a failed member fetch.
- Invite commands may fetch all guild invites and create a permanent invite.
- Deployment clears command registrations before replacing them, causing a temporary gap.

Use targeted fixes when working on these areas; do not treat this document as a claim that every failure mode is solved.

## Official references

- [YouTube REST resources](https://developers.google.com/youtube/v3/docs/)
- [Quota costs and Pacific reset](https://developers.google.com/youtube/v3/determine_quota_cost)
- [YouTube API error reasons](https://developers.google.com/youtube/v3/docs/errors)
- [node-cron scheduling and overlap prevention](https://github.com/node-cron/node-cron)
- [pnpm store settings](https://pnpm.io/settings/store)

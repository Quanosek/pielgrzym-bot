# Pielgrzym: project map and operating constraints

This is the project-specific context for coding agents. Keep it synchronized with behavior changes.
Use this map to locate the relevant implementation, not as a substitute for checking code that has changed since this document.

## Language and comments

- Format files consistently across the entire application: all source code, identifiers, internal logs, developer-facing errors, comments, and all file names across the repository must be in grammatically correct English.
- Keep code comments short and simple, on a single line, starting with a capital letter and without a trailing period.
  Use `//` for JavaScript comments; do not add block comments or narrate self-explanatory code.
- Write the main `README.md`, all documentation content (including `docs/*.md`, web documentation site content, and templates),
  and all user-facing or externally visible elements in grammatically and lexically correct Polish.
- Write every bot-authored Discord message in Polish, including public and ephemeral replies, errors, embeds, labels,
  placeholders, permission names, command descriptions, and counter channel names.
- Keep slash command, subcommand, and option identifiers in English. Keep machine-readable choice values and component IDs stable;
  their displayed labels and choices must be Polish.
- Preserve user-provided text, external content, usernames, URLs, product names, and API identifiers without translation.
  For example, `/echo` forwards the user's text and YouTube notifications retain the original video titles and comments.

## Visual clarity and controlled maintenance

- Preserve the established dark graphite palette, restrained gradients, compact spacing, and Discord-inspired hierarchy.
  Reuse existing components and tokens; do not add decorative icons, badges, colors, repeated text, or large padding without a clear request.
- Keep controls visually consistent in default, hover, focus, and disabled states. The animated border is a deliberate support-link exception, not a default for every control.
- Verify optical alignment, not only flex-box bounds. Preserve readable labels, visible keyboard focus, safe areas, and usable touch targets.
- Check desktop and narrow mobile layouts, hamburger navigation, search overlays, dynamic viewport changes, long content, and reduced motion.
  Use Playwright when changing layout or interactions; report simulated-device limits honestly.
- Keep source, identifiers, and file paths in English; keep README, guides, and interface text in Polish. Preserve upstream names and user content.
- Read affected callers before editing. Make complete, surgical changes and preserve locks, persistence contracts, permissions, and existing user work.
  Avoid speculative refactors, dependencies, abstractions, or redesigns. Keep optional visual effects detachable from native link behavior.
- Document procedures as prerequisites, exact commands, expected outcomes, and failure/recovery steps. Distinguish development start, deployment, and process restart.
- Validate with existing formatting/linting and targeted isolated mocks or browser checks. Never start the live bot, use real API quota, deploy commands, or change runtime data just to verify code.
  State what offline checks cannot certify; do not claim end-to-end delivery or legal compliance based on local checks.
- Keep README a standalone introduction and quick start, detailed procedures in `docs/`, and these instructions focused on implementation constraints.
  Keep public feature descriptions consistent with actual behavior and known limitations.

## Purpose and runtime

- Single-process Discord bot for monitoring one selected YouTube channel per guild, routing notifications to selected Discord channels, tracking statistics, and optionally adding published videos to Notion. Bot-authored user-facing messages are Polish.
- CommonJS JavaScript, Node.js >= 24, pnpm >= 11; package manager pinned in `package.json`.
- `pnpm pm2:start` starts `ecosystem.config.js`; `pnpm pm2:restart` restarts it with `--update-env`.
  PM2 must already be installed in the selected Node environment. Neither shortcut installs dependencies nor deploys slash commands.
  `run.sh` uses these shortcuts after installation and global command deployment. Never run them merely to validate a change.
- `config/index.js` provides module configuration summaries for startup logging, not feature-disable switches or remote health checks.
  Runtime adapters still read and validate their own environment settings; do not describe it as the sole configuration validator.
- Server ownership: `index.js` starts Express through `services/web-server.js`; that service configures HTTP routes and mounts callback handlers from `services/notion-oauth.js`.
  OAuth state, callback exchange, and confirmation flow belong to the OAuth service. Do not introduce a second listener for Notion.
- No transpilation, database server, or build step. One Express server serves project documentation and the Notion OAuth callback route.
- `discord.js` 14 handles Discord; the client subscribes only to `GatewayIntentBits.Guilds`.
- `node-cron` 4 is an npm dependency running inside the bot process, NOT a built-in Node.js module or operating-system cron.
- YouTube uses native `fetch` against `https://www.googleapis.com/youtube/v3/`. Do not restore `googleapis`,
  `node-fetch`, deprecated transitive packages, or dependency overrides merely to implement these public reads.
- Public YouTube data requires `YOUTUBE_API_KEY`, not OAuth. Enable YouTube Data API v3 in the Google Cloud project.
- Express exposes the dynamically rendered documentation site at `WEB_HOST:WEB_PORT` (defaults to `127.0.0.1:3001`); use HTTPS through a reverse proxy for remote access.
  Home (`/`) renders a featured hero with a static YouTube → Discord / optional Notion diagram, then `README.md` from its first H2.
  The README keeps its full title and introduction on GitHub; parse Markdown tokens rather than hiding duplicate introductory content with CSS.
  `/table-of-contents` renders chapter cards from `documents[]`; it and `/commands` use compact variants of the shared hero.
  Their illustrations are distinct: an open connected chapter map for contents, and oversized slash typography with syntax examples for commands.
  Sidebar navigation follows the current document section and scrolls only its own container to keep the selection visible.
  Thread labels are not highlighted; progress uses one deliberately faint, continuous one-pixel line.
  Interpolate progress within sections and update it each animation frame directly from scroll position, without a delay or time-based easing.
  Use zero-duration Web Animations keyframes without inline style attributes; scroll speed determines the line's speed, with no trailing motion.
  `aria-current` identifies the current section.
  `/commands` is auto-generated at startup from every `commands/<group>/*.js` via `SlashCommandBuilder.toJSON()`.
  Its parameter lists include declared choice labels and machine values; restart after changing command definitions.
  `/search-index.json` returns documents, every `##` heading (anchored by slug), and all commands/subcommands; the `Ctrl+K` client-side search in `web/public/scripts.js` queries it.
  The header support icon stays to the right of search; it and the footer's “Wesprzyj” link point to `https://buycoffee.to/kubaklalo`.
  The home hero is followed by a star-themed invitation section using optional `DISCORD_INVITE_URL` (HTTPS without credentials).
  Missing configuration visibly disables invitation; invalid configuration fails the home request explicitly.
  Invitation opens a native new tab and plays a temporary full-screen rainbow star flight on the original page; reduced motion uses a static color wash.
  Flight slowly accelerates on hover or keyboard focus and speeds up on press; its origin follows the button every frame with a soft transparent opening preserving readability.
  All invitation animation logic is isolated in `web/public/invitation-animation.js`; remove its script tag from the layout to retain only native invitation-link behavior.
  Background dimming grows slowly; desktop exit restores the background in 160ms, fades individual stars over 110–240ms and ribbons over 220–380ms while shortening trails and slowing motion.
  Exit has no flash; reduced motion and mobile clean up immediately.
  Cancellation, focus loss, or hiding the page also cleans up.
  Coarse-pointer devices without hover automatically run the home animation at 1% speed, with acceleration capped at 0.12 and background dimming capped at 30%; touch does not trigger hover or press effects.
  Mobile stars use a fixed initial pixel origin and radius so scrolling and browser-toolbar height changes cannot shift or zoom the field.
  Mobile appearance uses a three-minute exponential fade and bounded exponential acceleration without a sudden ramp; only the button's exact bounds are cleared for readability.
  Mobile stars and ribbons have damped scroll parallax capped at 2px before depth scaling (4px maximum), disabled for reduced motion.
  At widths up to 900px a single-row header exposes a hamburger disclosure containing search, external links, and the existing sidebar; it stays above the animation.
  The mobile menu fills the dynamic viewport below the header, locks background scrolling, and overlays search results above channels without shifting actions.
  Shared dynamic viewport height sizing covers message screens, sidebar and menu; safe-area padding remains inside the filled menu background.
  Ambient animation follows soft navigation and pauses when hidden; returning restarts its gradual appearance. Mobile header/footer use safe-area insets and 44px main touch targets.
  A GitHub repository icon follows the header support link with a normal hover effect; the footer places “Wesprzyj” before GitHub.
  The compact monochrome footer places navigation beside the name/version and external actions on the right, with author attribution below.
  Attribution is a single text line with a normal space before the website link; no icons or badges, and mobile wraps without centering.
  A decorative dot separates identity from navigation; the lower row contains a neutral copyright/license notice without claiming EU compliance.
  Both support links show a subtle white border glint on hover or keyboard focus, without motion when reduced motion is requested.
  `images/buycoffee-white.svg` preserves the white cup symbol path from the official `https://buycoffee.to/img/brand/bc-logo.svg` logo, with a symbol-only viewBox.
  Markdown code fences must declare their language or format (`js`, `sh`, `json`, `dotenv`, `text`, etc.); Discord slash examples are plain `text`.
  Code blocks use server-side highlight.js (dotenv uses its INI grammar), with escaped plain text for unknown formats and no auto-detection.
  The language label and copy button live in a separate toolbar outside the horizontally scrolling `pre`; copy only the original code text.
  CSP allows only `self` for scripts/connect/img, Google Fonts for styles/fonts, and no inline scripts. Never introduce inline `<script>` or external script sources.
  `utils/web-message.js` renders standalone full-screen OAuth outcomes and HTTP errors with the shared gradient background and dark card.
  Error cards show an icon square beside plain HTTP status text with the standard English reason phrase from Node's `STATUS_CODES`, then a full-width Polish title.
  Success cards show the green icon square immediately left of the title with no HTTP label; keep optional workspace detail and one next-step message.
  Place both navigation links together at the bottom right with a gap; no repeated branding or instructions.
  Escape all message content, preserve HTTP status codes (including static-file 404s and malformed-URL 400s), and retain no-store/no-referrer/nosniff headers.
  Message pages have no scripts and allow only the local stylesheet/images and Google Fonts through CSP; successful JSON/assets keep their original response types.
  OAuth success means credentials are staged, not saved: the user must still confirm on Discord and configure `/notion enable`.
- Notion publishing is optional and uses native `fetch` with per-guild OAuth credentials; it reads the existing YouTube cache, not YouTube APIs.
- `bufferutil` is retained as an optional Discord performance optimization, with its build explicitly allowed.
  `zlib-sync` is deliberately absent: discord.js automatically disables gateway transport compression without it.
  This removes that C++ build requirement at the cost of increased bandwidth. Do not invent an unsupported `ws.compression` option.

## Entry points and structure

| Location                                                      | Responsibility                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.js`                                                    | Load dotenv, create the Discord client, load handlers, start the Express documentation/OAuth server, log in.                                                                                                                                                                  |
| `handlers/commands.js`                                        | Load `commands/<group>/*.js` into `client.commands` when exports contain `data` and `execute`.                                                                                                                                                                                |
| `handlers/events.js`                                          | Register `events/*.js` using their `name`, `once`, and `execute` exports.                                                                                                                                                                                                     |
| `events/interaction-create.js`                                | Dispatch channel-select components and slash commands; check bot permissions and report command failures.                                                                                                                                                                     |
| `events/ready.js`                                             | Register recurring YouTube jobs and independent Notion delivery after Discord becomes ready.                                                                                                                                                                                  |
| `events/guild-create.js`, `events/guild-delete.js`            | Initialize/remove guild configuration; cancel Notion sessions and remove guild credentials on departure.                                                                                                                                                                      |
| `commands/utility/`                                           | About, echo, info, invite, ping, reaction management, support.                                                                                                                                                                                                                |
| `commands/youtube/index.js`                                   | Slash-command definition/router; restrict management to administrators or configured owner.                                                                                                                                                                                   |
| `commands/youtube/enable.js`                                  | Resolve handle, then legacy username; save channel/setup date and populate uploads cache.                                                                                                                                                                                     |
| `commands/youtube/{disable,counter,settings,status,check}.js` | Disable monitoring/counters, configure channels, display state, request immediate checks.                                                                                                                                                                                     |
| `commands/notion/index.js`, `commands/notion/settings.js`     | Administrator-only Notion commands and paginated, persistent column-mapping prompts.                                                                                                                                                                                          |
| `config/index.js`                                             | Modular configuration provider and feature detection across Discord, YouTube, Web, and Notion.                                                                                                                                                                                |
| `config/notion.js`                                            | Versioned, rate-paced Notion REST requests, source resolution, schema checks, and page creation.                                                                                                                                                                              |
| `services/notion-publisher.js`, `utils/notion-store.js`       | Independent cached-video delivery, persistent pending/completed entries, and uncertain-write recovery.                                                                                                                                                                        |
| `services/notion-oauth.js`, `utils/notion-auth.js`            | OAuth callback, user/guild-bound confirmation, encrypted credentials, and serialized token refresh.                                                                                                                                                                           |
| `services/web-server.js`                                      | Express site: dynamic nav channels, markdown→HTML with H2 anchor slugs, commands guide loader, search-index endpoint, Notion OAuth callback mount.                                                                                                                            |
| `docs/*.md`                                                   | Seven file-backed chapters. Each starts with `# N. Title`, a `<!-- channel: polish-slug -->` marker, and a `<div class="section-subtitle">` lead.                                                                                                                             |
| `web/public/styles.css`, `web/public/scripts.js`              | Dark Discord-inspired theme (Sora + Inter + JetBrains Mono) with gradient tokens; vanilla JS for copy-code buttons, `Ctrl+K` search dropdown, and soft-navigation (fetch + sidebar/content swap with `popstate` support) that avoids full page reloads for same-origin links. |
| `handlers/interactions/channel-select.js`                     | Route channel-select callbacks registered by settings UI.                                                                                                                                                                                                                     |
| `config/youtube.js`                                           | Shared API adapter, enabled-monitoring configuration, uploads-playlist ID derivation.                                                                                                                                                                                         |
| `services/yt-videos-cache.js`                                 | Download all pages of the uploads playlist and replace the guild's cached videos.                                                                                                                                                                                             |
| `services/yt-videos-monitor.js`                               | Detect new uploads, notify Discord, increment local video count, schedule post-publication statistics.                                                                                                                                                                        |
| `services/yt-comments-monitor.js`                             | Scan recent/priority videos, diagnose old videos, fetch replies, deduplicate, format notifications.                                                                                                                                                                           |
| `services/yt-subs-counter-monitor.js`                         | Fetch/store channel statistics and update the subscriber voice channel.                                                                                                                                                                                                       |
| `services/yt-views-counter-monitor.js`                        | Maintain view-count history and derive the displayed annual/estimated count.                                                                                                                                                                                                  |
| `services/yt-videos-counter-monitor.js`                       | Update the video-count voice channel from channel statistics.                                                                                                                                                                                                                 |
| `utils/guild-config.js`                                       | Guild configuration persistence, enable/disable, serialized JSON writes.                                                                                                                                                                                                      |
| `utils/yt-cache.js`                                           | Video/comment cache persistence, normalization, metadata merging, serialized JSON writes.                                                                                                                                                                                     |
| `utils/yt-task.js`                                            | Serialize monitoring/cache/statistics work for the same guild; different guilds can run independently.                                                                                                                                                                        |
| `utils/format-number.js`                                      | Spaced numbers and Polish compact suffixes.                                                                                                                                                                                                                                   |
| `utils/permissions.js`                                        | Shared command permission definitions.                                                                                                                                                                                                                                        |
| `deploy-commands.js`                                          | Register guild/global commands or clear registrations; not part of normal startup.                                                                                                                                                                                            |
| `ecosystem.config.js`, `run.sh`                               | Single-instance PM2 deployment; pull, select Node, install, deploy commands, restart/start.                                                                                                                                                                                   |
| `data/`, `logs/`, `.env`                                      | Local runtime state/secrets; ignored by Git. Never expose their contents.                                                                                                                                                                                                     |
| `images/`                                                     | Bot imagery.                                                                                                                                                                                                                                                                  |

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
- The Express documentation site starts with the bot at `http://127.0.0.1:3001` by default.
  Pages are rendered on the fly; the sidebar's first three channels (`strona-glowna`, `spis-tresci`, `komendy-bota`) come from the `navChannels` array in `services/web-server.js`, the rest come from `documents[]`.
  `documents[]` lists only file-backed chapters (`01`–`07`); their displayed title/channel/threads are hydrated at startup by reading each MD file's H1, `<!-- channel: … -->` comment, and every `##` heading.
  Markdown H2s receive `id` attributes using the same Polish-aware slug function used for sidebar thread links, so clicks jump to the correct section.
  URLs stay English (`/commands`, `/table-of-contents`, `/docs/<slug>`); displayed labels and heading ids stay Polish. `/docs/00-table-of-contents` and `/spis-tresci` 301-redirect to `/table-of-contents`.
  The site never exposes runtime data, `.env`, or `AGENTS.md`. Configure `WEB_HOST` and `WEB_PORT` to change its listener; put remote access behind HTTPS.
- Production uses `bash ./run.sh`, nvm, and PM2. Keep `instances: 1`.
- `.env.example` documents Discord identifiers, `YOUTUBE_API_KEY`, documentation host/port, and optional Notion OAuth credentials, encryption key, and callback binding.
  Do not read real `.env` values into chat, logs, fixtures, or documentation.
- Slash-command modules export `permissions`, `data` (`SlashCommandBuilder`), and `execute`.
  UI settings use Discord Components V2 and ephemeral replies, with dynamically registered select handlers.
  The `/commands` web guide reads every module's `.data.toJSON()` at Express startup — renaming a command or option updates the guide automatically. Do not duplicate command metadata in `docs/*.md`; link to `/commands` instead.
- Format with existing Prettier configuration: no semicolons, single quotes, two spaces, LF, 150-column width.
  ESLint uses flat config with recommended JavaScript/Node rules plus Prettier; a dedicated override applies browser globals to `web/public/**/*.js` and disables the `n/no-unsupported-features/node-builtins` rule there.
  `.gitignore` ignores `.env`, `data/`, `logs/`, `node_modules/`, `.pnpm-store/`. `.prettierignore` additionally ignores `pnpm-lock.yaml` (Prettier may otherwise rewrite it).
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

## Notion publishing

### Scope and setup

- Notion is a destination for published YouTube videos, not a calendar-monitoring source.
  Create new rows; never match or modify manual plans by title. No Notion-to-Discord notifications or Notion counters are implemented.
- One destination data source is configured per Discord guild under `notionIntegration` in the existing guild configuration.
  Existing YouTube settings and credentials are not migrated or replaced.
- Each guild authorizes its own workspace through a public OAuth connection with Read content and Insert content capabilities.
  The bot author does not need personal membership in these workspaces; the authorized application receives access.
  Share the original database during authorization. A normal page or linked calendar URL may not identify the original data source.
  Never accept or display tokens through commands or components; there is no global `NOTION_TOKEN` fallback.
- REST uses the documented `2026-03-11` Notion version and data-source APIs, not the deprecated database-query endpoint.
  A database URL/ID resolves to its available data sources; multiple sources are selected through paginated menus.
- The integration writes into an existing table. Calendar layout, visibility filters, relations, and other database views remain managed in Notion.
  Entries from other tables are not imported or rewritten.

### Discord configuration

- `/notion connect` creates an ephemeral authorization link and confirmation button bound to the requesting Discord user and guild.
  Callback success only stages credentials in memory; the administrator must review the workspace identity and confirm again in Discord.
  Fresh membership/administrator verification precedes persistence. The configured owner remains an allowed administrator override.
- `/notion disconnect` cancels pending sessions, pauses delivery, invalidates mapping panels, and deletes only this guild's local credentials.
  It deliberately does not revoke the provider installation, which could be used by another guild. Users can revoke access in Notion.
  Reconnecting also pauses the previous table configuration; `/notion enable` is required to select and bind the destination again.
- `/notion enable source:<URL or ID>` starts a private configuration wizard.
  `/notion settings` restarts column mapping for the selected source; publishing pauses until the wizard is completed.
- Prompts select a title property, date property, URL property, and optional status/select property plus an existing status option.
  All mappings use stable property and option IDs, not hard-coded names; renamed columns remain compatible.
- Menus paginate at 25 options. Component IDs carry a revision and step stored in configuration.
  Validate guild administrator/owner permissions and the current revision on every component interaction.
  This works after restart; it does not depend on registering in-memory callbacks when settings are opened.
- The final step validates the schema, binds the current YouTube channel ID and original monitoring setup date,
  enables publishing, and marks cached history for processing.
- `/notion status` reports mappings, completed/pending counts, source/channel mismatch, and uncertain video IDs.
  `/notion check` validates access/schema and processes up to five due entries.
  `/notion disable` pauses publishing without deleting pages or the delivery queue.
- `/notion retry video-id:<ID> confirmed:true` explicitly releases an uncertain attempt only after an administrator
  verifies that no page exists and no write is still in progress.
- Replies and UI are Polish and ephemeral. Raw API errors and secrets are never sent to Discord.

### Delivery and historical import

- A separate `* * * * *` cron job reads `videosCache` every minute for Notion-enabled guilds.
  It does not modify YouTube monitors, their schedules, their API calls, or their cache writes.
  Normal latency is the existing YouTube cache refresh interval plus the Notion worker interval and queue backlog.
- Import all available cached videos whose publication date is on/after `ytMonitoring.setupDate`.
  Do not fetch missing history from YouTube. A missing, deleted, or never-cached video cannot be reconstructed.
  Initial backfill and subsequent additions follow the same durable queue.
- If YouTube monitoring is disabled or points to a different channel than the Notion binding, pause the worker.
  Reconfiguration is required to bind a different channel; never silently deliver another channel's cache.
- Notion work uses the `notion:<guildId>` key in `runGuildTask`, distinct from YouTube's guild ID key.
  Slow Notion requests must not hold the YouTube monitoring lock.
- Store state in ignored `data/notion-cache.min.json`: per-guild `pending` job snapshots and `completed` page IDs,
  keyed by `<dataSourceId>:<videoId>`. Writes are serialized and atomic, with no rewrite when no videos were added.
  Invalid state fails explicitly rather than clearing delivery history.
- Before creating a page, query the selected URL column for the canonical `https://www.youtube.com/watch?v=<id>` address.
  An exact existing URL is treated as delivered without modifying that page. Titles are not a deduplication key.
- Persist `uncertain: true` BEFORE sending page creation. On success, move the job to `completed`.
  Network/timeout/5xx/invalid-success-response ambiguity remains uncertain: later runs query for the URL but never blindly repeat creation.
  Definite HTTP rejections other than timeout/server failures can be retried with backoff.
- At most five due entries are processed per worker run; requests are serialized at least 350 ms apart.
  Respect `Retry-After` after 429; retry delays grow from one minute up to one hour.
  Failed entries remain visible in status and do not disappear after restart.
- Property changes are revalidated. Unsent, non-uncertain jobs use the current mapping; uncertain jobs retain
  the original mapping for reconciliation until explicitly released.
- Publication dates use the actual YouTube publication instant with the correct Europe/Warsaw offset, including DST.
  Titles are HTML-decoded; status is assigned only when configured. No manual source-table schema changes are performed.

### Operational boundaries

- Operator configuration is `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `NOTION_REDIRECT_URI`, and `NOTION_TOKEN_ENCRYPTION_KEY`.
  Use a public Notion OAuth connection, not an internal connection secret or personal user token.
  The redirect must be HTTPS with exactly `/notion/oauth/callback`, without credentials, query, or fragment,
  and must match the URI registered in Notion. The same URI is sent when exchanging the authorization code.
- The Notion OAuth callback is an Express route on the documentation server (`WEB_HOST:WEB_PORT`, default `127.0.0.1:3001`).
  Deploy behind an HTTPS reverse proxy and disable query-string logging on the callback route.
  No public domain is bundled or automatically provisioned. All four required OAuth settings absent means Notion is disabled;
  partial/invalid settings or a bind failure explicitly fail startup. Existing YouTube credentials and channel mappings do not change.
- OAuth states contain 32 random bytes, are indexed by SHA-256, expire after ten minutes, and can be consumed only once.
  At most 1,000 sessions are retained; starting a new flow invalidates that guild's old flow.
  Expiry, disconnect, guild departure, and shutdown clear pending authorization; restart invalidates all pending flows.
  Browser responses contain no tokens and use no-store/referrer/CSP headers. Never log callback codes or token responses.
- `data/notion-auth.min.json` stores AES-256-GCM encrypted credentials with a random nonce and guild ID as authenticated data.
  Keep the base64-encoded 32-byte encryption key stable and back it up securely with runtime data.
  Generate it with `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`.
  Missing/corrupt credentials fail explicitly; never silently reset or regenerate the key.
  Losing it requires reconnection. File writes are serialized and atomic; restrict OS permissions on runtime data and `.env`.
- API calls always resolve credentials using the requesting guild ID. A 401 allows one serialized refresh and resend;
  rotated refresh tokens are persisted, and a workspace change in a refresh response is rejected.
  The `notion-auth:<guildId>` lock protects refresh/replacement/deletion; acquire it inside `notion:<guildId>` when both are needed.
  Publishing additionally requires the configured `workspaceId` to match the credential binding. There is one workspace/table per guild.
- The former internal-token setup requires `/notion connect` and `/notion enable`; no implicit token migration is performed.
  This migration affects only Notion. No extra YouTube API calls or changes to YouTube monitoring are introduced.
- No exactly-once transaction spans the local file and Notion. URL checks, durable completion records, and suspended
  uncertain writes reduce duplicate risk; manual concurrent edits/creation or authorizing retry too early can still create duplicates.
- Keep one bot process and persist the delivery file. Deleting it loses local completion/uncertainty history.
  Exact URL lookup still helps, but edited URLs and deleted/moved pages cannot be reliably reconciled.
- Completed records are retained; delivery is not a continuous repair or update of existing Notion pages.
  Changing a video title later or deleting a previously completed page does not automatically rewrite/recreate it.
- Pages appear in the calendar only if its selected date property and view filters include the newly written values.
- Real workspace access and Insert content capability cannot be certified by offline validation.
  Configure the public OAuth app and HTTPS callback, then use `/notion connect`, the mapping wizard, and `/notion check`.

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
- Event loader registration catches do not catch asynchronous event-handler rejections; startup/login failures are handled in `index.js`.
- `/youtube enable` disables old monitoring before validating the replacement; it assumes a high-resolution channel thumbnail.
- `/info user` can dereference a null member after a failed member fetch.
- Invite commands may fetch all guild invites and create a permanent invite.
- Deployment clears command registrations before replacing them, causing a temporary gap.

Use targeted fixes when working on these areas; do not treat this document as a claim that every failure mode is solved.

## Official references

- [Notion databases and data sources](https://developers.notion.com/guides/data-apis/working-with-databases)
- [Notion page creation](https://developers.notion.com/reference/post-page)
- [Notion authorization](https://developers.notion.com/docs/authorization)
- [Notion token exchange and refresh](https://developers.notion.com/reference/create-a-token)
- [Notion API limits](https://developers.notion.com/reference/request-limits)
- [Notion API versioning](https://developers.notion.com/reference/versioning)
- [YouTube REST resources](https://developers.google.com/youtube/v3/docs/)
- [Quota costs and Pacific reset](https://developers.google.com/youtube/v3/determine_quota_cost)
- [YouTube API error reasons](https://developers.google.com/youtube/v3/docs/errors)
- [node-cron scheduling and overlap prevention](https://github.com/node-cron/node-cron)
- [pnpm store settings](https://pnpm.io/settings/store)

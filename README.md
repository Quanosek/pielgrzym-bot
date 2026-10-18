# Pielgrzym

Discord bot for zbawienie.pl and zasobybiblijne.org, with YouTube video and comment notifications and voice-channel statistics.

## Run locally

Requires Node.js >= 24 and pnpm >= 11.

1. Copy `.env.example` to `.env` and fill in your Discord credentials and YouTube Data API v3 key.
2. Install dependencies and start the bot:

```sh
pnpm install
pnpm start
```

Register slash commands with `pnpm deploy:guild` for development or `pnpm deploy:global` for production.
Use `/youtube` to configure monitoring and counters.

## Production

With nvm and PM2 installed, run `bash ./run.sh`. Keep one bot instance.

## Maintenance

```sh
pnpm update
pnpm validate
```

Architecture, schedules, API quota accounting, and development constraints: [AGENTS.md](AGENTS.md).

# tinydoom.com

Website and API for Tiny Doom game studio.

## Stack

- **Runtime**: Bun
- **Framework**: Next.js (Turbopack)
- **Linting**: Biome
- **Styling**: Tailwind CSS
- **Database**: Vercel Postgres + Drizzle ORM
- **Secrets**: git-crypt

## Development

```bash
bun install
bun dev
```

## Database

```bash
bun run db:migrate # apply committed migrations
bun run db:studio  # open Drizzle Studio
```

## Telemetry

The Hammerbound API contract lives in [`docs/telemetry.md`](docs/telemetry.md).
The weekly Discord cron needs `CRON_SECRET`, `DISCORD_BOT_TOKEN`, and
`TELEMETRY_DISCORD_CHANNEL_ID`. Preview builds migrate their isolated Neon branch.

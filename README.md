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
bun run db:push    # push schema to database
bun run db:studio  # open Drizzle Studio
```

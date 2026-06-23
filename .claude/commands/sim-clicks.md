Report how many times the sim button was clicked, straight from the production database.

## Context

Every click on the sim button in the results page fires a POST to `/api/click` ([api/click.ts](../../api/click.ts)) with `{ feature: 'sim', who }`, which inserts a row into the unified `clicks` table in Neon Postgres. Each row has a `feature` tag, a `who` (the participant the viewer identified as, or null when anonymous), and a `clicked_at` timestamp. This is the usage signal for the simulator feature (see "Validate Value First").

## Steps

### 1. Query the database

Run this from the repo root — it loads `DATABASE_URL` from `.env.development.local` and queries via the already-installed `@neondatabase/serverless` package:

```bash
set -a && . ./.env.development.local && set +a && node -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
Promise.all([
  sql\`SELECT count(*)::int AS total,
           count(*) FILTER (WHERE clicked_at > now() - interval '24 hours')::int AS last_24h,
           count(*) FILTER (WHERE who IS NOT NULL)::int AS identified,
           min(clicked_at) AS first,
           max(clicked_at) AS last
       FROM clicks WHERE feature = 'sim'\`,
  sql\`SELECT coalesce(who, '(anonymous)') AS who, count(*)::int AS n
       FROM clicks WHERE feature = 'sim'
       GROUP BY who ORDER BY n DESC LIMIT 10\`,
]).then(([h, byWho]) => console.log(JSON.stringify({ headline: h[0], byWho }, null, 2)));
"
```

### 2. Report

Tell the user:
- The total click count
- How many in the last 24 hours
- Who clicked the most (top few participants by count), and how many were anonymous
- When the first and last clicks happened, converted to Israel time (UTC+3 in summer)

Keep it to a few sentences. If the trend is notable (e.g. zero clicks since launch night), say so — that's the whole point of the signal.

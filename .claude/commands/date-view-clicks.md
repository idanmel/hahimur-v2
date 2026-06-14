Report how many times the לפי תאריך toggle was clicked, straight from the production database.

## Context

Every click on the לפי תאריך toggle on the forms page fires a POST to `/api/date-view-click` ([api/date-view-click.ts](../../api/date-view-click.ts)), which inserts a row into the `date_view_clicks` table in Neon Postgres. Each row has a `clicked_at` timestamp. This is the usage signal for the chronological forms view.

## Steps

### 1. Query the database

Run this from the repo root — it loads `DATABASE_URL` from `.env.development.local` and queries via the already-installed `@neondatabase/serverless` package:

```bash
set -a && . ./.env.development.local && set +a && node -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
sql\`SELECT count(*)::int AS total,
         count(*) FILTER (WHERE clicked_at > now() - interval '24 hours')::int AS last_24h,
         min(clicked_at) AS first,
         max(clicked_at) AS last
     FROM date_view_clicks\`
  .then(r => console.log(JSON.stringify(r[0], null, 2)));
"
```

### 2. Report

Tell the user:
- The total click count
- How many in the last 24 hours
- When the first and last clicks happened, converted to Israel time (UTC+3 in summer)

Keep it to a few sentences. If the trend is notable (e.g. zero clicks since launch night), say so — that's the whole point of the signal.

# Sim Click Counter

Every click of the סימלוץ button on the results page is recorded as one row
in the `sim_clicks` table on Neon (Vercel → Storage → Neon → Open in Neon →
SQL Editor). Rows hold only a timestamp — no user data.

## The headline number

```sql
SELECT count(*) FROM sim_clicks;
```

> "We ran X simulations during WC 2026."

## Clicks per day

```sql
SELECT clicked_at::date AS day, count(*)
FROM sim_clicks
GROUP BY day
ORDER BY day;
```

## How it works

- `api/sim-click.ts` — POST inserts one row.
- `randomize()` in `src/pages/results/ResultsPage.tsx` fires a
  fire-and-forget `fetch` to it; failures are swallowed so the counter can
  never break the simulator.

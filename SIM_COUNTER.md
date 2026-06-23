# Click Counters

Every tracked button (sim, "הכל צליפות", לפי תאריך) records one row in the
unified `clicks` table on Neon (Vercel → Storage → Neon → Open in Neon → SQL
Editor). Each row carries a `feature` tag, a `who` (the participant the viewer
identified as, or NULL when anonymous), and a `clicked_at` timestamp.

## The headline number (sim)

```sql
SELECT count(*) FROM clicks WHERE feature = 'sim';
```

> "We ran X simulations during WC 2026."

## Clicks per day, per feature

```sql
SELECT feature, clicked_at::date AS day, count(*)
FROM clicks
GROUP BY feature, day
ORDER BY feature, day;
```

## Who clicked the most

```sql
SELECT feature, coalesce(who, '(anonymous)') AS who, count(*)
FROM clicks
GROUP BY feature, who
ORDER BY feature, count(*) DESC;
```

## How it works

- `api/click.ts` — POST `{ feature, who }` inserts one row.
- `reportUsage(feature, who)` in `src/shared/reportUsage.ts` fires a
  fire-and-forget `fetch` to it; failures are swallowed so the counter can
  never break the feature it measures.
- Call sites: `randomize()` and `showAllTzelifot()` in
  `src/pages/results/ResultsPage.tsx` (feature `sim` / `all-tzelifot`), and the
  by-date toggle in `src/formView/FormView.tsx` (feature `date-view`).

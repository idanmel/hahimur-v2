# Golden Boot Race — Results Page

## Context

A user asked for a place on the site that shows **the race to the Golden Boot** (המירוץ
לנעל הזהב). Today the Results page has a "מלך השערים" section
([GoalScorerSection.tsx](src/pages/results/GoalScorerSection.tsx)) that is a
**what-if editor only**: it lists the players participants picked, lets you type each one's goal
tally, and check off the Golden Boot winner(s). Those flow into `tournamentResults.playerGoals` /
`goldenBootWinner` ([ResultsPage.tsx:260-261](src/pages/results/ResultsPage.tsx#L260-L261))
and drive the Golden Boot points in `computeGoldenBootBreakdown`
([points.ts:313-319](src/leaderboard/points.ts#L313-L319)): **3 pts/goal** for your
pick + a **10-pt bonus** if your pick is a Golden Boot winner.

Two gaps: it only shows *picked* players (so you can't see the actual race — e.g. **Lionel Messi,
unpicked, is co-leading at 6**, and if he stays sole leader nobody gets the bonus), and the numbers
are hand-typed, not real. The ask: turn this into a live race board that includes the real top
scorers, picked or not.

### Rules (confirmed)
- Golden Boot = the tournament's top scorer(s) overall, **picked or not**. Ties → **multiple**
  winners, each picker gets +10 (already handled by the array path in
  [points.ts:316](src/leaderboard/points.ts#L316)).
- **Standard FIFA counting**: penalty **shootout** goals do **not** count; own goals aren't credited.
  No assist/minutes tiebreakers — goals only.
- **Live** leader shown throughout; the +10 bonus only truly locks at tournament end.

### The section does two things
1. **Shows the race** — a sorted standings board of real goal totals, highlighting the current
   leader(s), including real unpicked leaders/chasers.
2. **Stays a what-if editor** — keep per-row goal inputs **and** the winner checkbox so users can
   override and watch their points move.

## Data source — live from the ESPN feed we already have (no cron, no token)

The deployed `/api/live-scores` proxy fetches the **entire tournament window** and already extracts
every scorer per event ([live-scores.ts:9-10,55-61](api/live-scores.ts#L55-L61)).
Verified against live data: ESPN retains scoring `details` for **all 78 completed matches**, so
accumulating scorer occurrences across events yields correct tournament totals for **every** player,
picked or not — no football-data, no token, no cron, no repo snapshot.

**Verified correctness gotchas (both real, both found in the live data):**
- **Shootout leak (must fix):** ESPN lists shootout kicks as `scoringPlay:true, type:"Penalty -
  Scored"` — *indistinguishable by type* from an in-match penalty — but each play carries an explicit
  **`shootout: true`** boolean. Naive accumulation over-counts (it inflated Saibari to 4; his real
  count is 3). The current proxy skips only `ownGoal`
  ([live-scores.ts:57](api/live-scores.ts#L57)), so it **leaks shootout goals
  today** — a latent bug in the existing picked-player overlay too. Fix: also skip `play.shootout`.
  With that filter, ESPN totals match football-data exactly (Saibari 3, Mbappé/Messi 6, Haaland 5).
- Own goals already excluded ([live-scores.ts:57](api/live-scores.ts#L57));
  `athletesInvolved` holds only the scorer (no assisters), so no double-count.

## Design decisions (resolved with user)

- **`tournamentResults.playerGoals` stays picked-only.** It feeds not just points but the win-prob
  Monte-Carlo sim, Crossings, Records, PodiumOnAdvance
  ([winProbWorker.ts](src/leaderboard/winprob/winProbWorker.ts), et al). The race
  board merges its display roster **locally**; unpicked players never enter `playerGoals`.
- **Picked rows render from `playerGoals`** (the exact number their points are scored from, live via
  the existing overlay). **Unpicked rows render from the ESPN accumulation.** The two currently agree;
  keeping picked on `playerGoals` guarantees the board never contradicts the points beside it.
- **Roster = all picked players ∪ unpicked players with 4+ goals** (`RACE_BOARD_MIN_GOALS` in
  goldenBootBoard.ts), sorted by goals desc. Picked players always show, even at 0. (Originally
  "within 1 goal of the lead"; changed 2026-07-03 so every real contender stays visible.)
- **Unpicked + eliminated + trailing the lead = dropped from the board** (added 2026-07-03, the
  Ismaïla Sarr case): his tally is frozen below a total he can't reach and nobody's points depend
  on him. An eliminated unpicked player **at** the lead stays — he can still (co-)win, which is
  what denies everyone the bonus. Picked players are never dropped; they get the "מחוץ למירוץ"
  badge instead.
- **Visual leader only.** The "מוביל" highlight is derived from max goals for *display*; it does
  **not** auto-award the +10. `goldenBootWinner` stays undefined by default (no premature bonus mid-
  tournament, matching today). The **checkbox remains the manual what-if** that awards the bonus.
- **All rows fully editable** (goal input + winner checkbox), unpicked included — so a user can
  simulate "the real leader fades and my pick catches up." Editing an unpicked player scores nobody
  points but moves the max, driving whether a picked player wins the bonus.
- **Hebrew names, curated.** Unpicked players come from ESPN in Latin script; a **separate**
  golden-boot Latin→Hebrew alias map (NOT `SCORER_ALIASES` — adding names there would leak goals into
  `playerGoals`) maps them. An uncurated player at/near the lead shows their **Latin name as a
  temporary fallback** rather than being dropped (never silently misreport the leader); curate the
  Hebrew later and it swaps in.

## Approach (thin vertical slices, CLAUDE.md — test-first)

### Slice 1 — Fix the shootout leak (foundation, tiny, independently valuable)
- **Test first**: extend the live-scores/espnLive scorer tests with a `shootout:true` play that must
  be excluded.
- One-line fix in [api/live-scores.ts:57](api/live-scores.ts#L57):
  `if (!play.scoringPlay || play.ownGoal || play.shootout) continue`. This corrects both the new
  feature and the existing picked-player live overlay.

### Slice 2 — Accumulate tournament totals from the feed
- **Test first**: a pure `accumulateScorerTotals(events)` → `Record<espnName, goals>` (sum scorer
  occurrences across all events; shootout/own-goal already stripped upstream). Unit-tested off fixture
  events.
- New hook (near [useLiveScores.ts](src/shared/useLiveScores.ts)) that fetches
  `/api/live-scores` **on mount regardless of liveness** (totals must show between match days) and
  re-polls while `isAnyLive` is true. Reuses the CDN-cached proxy; no new endpoint.

### Slice 3 — Race board UI on the Results page
- **Test first**: `GoalScorerSection` tests — sorted-by-goals order; unpicked leader ranked above
  picked players and badged "מוביל"; a within-1 chaser included, a 2-behind unpicked player excluded;
  zero-winner (unpicked sole leader) case; Latin fallback for an uncurated leader.
- Add the golden-boot Latin→Hebrew alias map (curate current names incl. Messi, Haaland).
- In [ResultsPage.tsx:437-444](src/pages/results/ResultsPage.tsx#L437-L444): build
  roster = `predictedPlayers(users)` ∪ (unpicked-within-1-of-lead from the accumulation, Hebrew-
  mapped); build `realGoals` = `{ ...playerGoals(picked), ...unpickedTotals }`. Pass through as today.
- Evolve `GoalScorerSection`: sort rows by goals desc; show each row's goal count; derive the "מוביל"
  badge from max goals (reuse/adjust `pg-scorer-row--winner`, add a `--leader` variant in
  [ResultsPage.css](src/pages/results/ResultsPage.css)); keep the goal input,
  the winner checkbox, and `pickersByPlayer` chips. Decouple the visual leader badge from the winner
  checkbox.

## Execution (model split)
- **Slices 1 & 2 → Haiku.** Mechanical and tightly specified (one-line shootout filter; a pure
  `accumulateScorerTotals` + an ungated fetch hook), fully guarded by tests. Cheap, low-risk.
- **Slice 3 → stronger model.** The UI integration carries the invariant-traps this plan exists to
  protect: decoupling the visual "מוביל" badge from the winner checkbox without breaking the existing
  `commitGoals`/`toggleWinners` what-if, keeping unpicked players out of `playerGoals`, no premature
  bonus, the within-1-of-lead boundary, and Latin fallback.
- **Test-first everywhere** so each slice's invariants are encoded before code — this is what makes
  the Haiku slices safe and keeps Slice 3's blast radius contained.

## Files
- **Edit**: `api/live-scores.ts` (shootout filter) + its test.
- **New**: `src/shared/scorerTotals.ts` (pure accumulator) + hook; tests. Golden-boot alias map
  (e.g. `src/pages/results/goldenBootNames.ts`).
- **Edit**: `src/pages/results/GoalScorerSection.tsx` (sort, goal-count, derived leader badge, keep
  inputs+checkbox), `ResultsPage.tsx` (merge roster + goals), `ResultsPage.css` (leader style),
  `GoalScorerSection.test.tsx`.
- **Reuse**: `useLiveScores`/`isAnyLive` fetch+poll pattern; `predictedPlayers`/`pickersByPlayer`
  ([ResultsPage.tsx:83-94](src/pages/results/ResultsPage.tsx#L83-L94)); `clampGoals`
  ([resultsUtils.ts](src/pages/results/resultsUtils.ts)); existing `pg-scorer-*`
  CSS; `computeGoldenBootBreakdown` unchanged (array path already handles multiple/zero winners).

## Verification
- `npm test` — new tests pass: shootout exclusion, `accumulateScorerTotals`, and the
  `GoalScorerSection` cases above.
- Data sanity (already spot-checked live): shootout-filtered ESPN totals equal football-data
  (Saibari 3, Mbappé/Messi 6, Haaland 5).
- Manual (user-driven per `feedback_visual_verification`): open Results → "מלך השערים"; confirm the
  board lists picked players + unpicked within-1-of-lead sorted by goals, badges the max-goals
  leader(s), shows "nobody wins" when the sole leader is unpicked, and that typing goals / toggling
  the winner still moves leaderboard points live. Optionally exercise the live path with the proxy's
  `?fake=...&fakeScorer=...` hook ([live-scores.ts:76-94](api/live-scores.ts#L76)).

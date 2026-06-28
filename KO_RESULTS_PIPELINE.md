# Knockout Results Pipeline — Regulation Score + Advancer

How knockout (KO) match results flow into the app, and the design behind it.
Companion to [SCORING.md](SCORING.md) (the points rules) and
[UPDATES_GUIDE.md](UPDATES_GUIDE.md).

## The rule

KO predictions are for **end of regulation (90')** only. A predicted `1-1` is a
90' prediction, and the bettor *also* names the advancer. The advancer is correct
if that team goes through **by any route** — regulation, extra time, or penalties.
For a predicted draw the advancer is entered explicitly (`drawWinner`).

A KO result therefore carries **two facts**: the regulation score, and who advanced
(which can differ from who led at 90').

## Data model

`MatchScores` (`src/shared/types.ts`) already carries the advancer:

```ts
interface MatchScores {
  home: number | null
  away: number | null
  drawWinner?: 'home' | 'away'   // the advancer, set when regulation ended level
}
```

- The **regulation** score lives in `home`/`away`.
- `drawWinner` is set **only when regulation was a draw** (the match went to ET/pens).
  A match only goes past 90' when level, so a decisive regulation score needs no
  `drawWinner` — the score itself names the winner.

## Scoring (already implemented — do not rebuild)

`src/leaderboard/points.ts` implements the rule end-to-end via `drawWinner`:

- `winner()` — a `1-1` resolves via `scores.drawWinner ?? 'draw'`.
- `isExactMatch()` — compares `drawWinner` too → צליפה.
- `singleMatchOutcome()` — draw-vs-non-draw + winner match → פגיעה / פספוס.
- `koMatchPoints()` — flips `drawWinner` when home/away are reversed between a
  bettor's prediction and the result fixture.
- **Advancement (עלייה) points are a separate channel** (`computeRoundBreakdown`):
  they compare predicted vs actual *next-round bracket teams*, NOT `drawWinner`.
  `drawWinner` only affects the per-match outcome (tzelifa/pgiya/miss).

Outcome matrix for a predicted regulation draw with an advancer
(locked by tests in `src/leaderboard/computeUserPoints.test.ts`):

| Predicted | Actual | Outcome |
|---|---|---|
| `1-1` adv home | `1-1` adv home | **צליפה** (incl. won-on-penalties) |
| `1-1` adv away | `2-2` adv away | **פגיעה** (right advancer, wrong score) |
| `1-1` adv home | `1-1` adv away | **פספוס** (right score, wrong advancer) |
| `1-1` adv home | `2-1` (decided in reg) | **פספוס** (predicted draw, wasn't one) |

So the engine just needs `results.knockoutStages` populated with KO matches whose
`scores` carry the regulation score + `drawWinner`.

## Score sources

### ESPN — primary (timely; powers the live overlay)

- The **scoreboard** endpoint returns the **after-ET** `score` and `linescores: null`
  for KO matches — unusable for the 90' rule.
- The **per-event summary** endpoint
  (`.../summary?event=<id>`) carries per-period `linescores`
  `[1st half, 2nd half, ET1, ET2, shootout]`:
  - **Regulation 90' = linescores[0] + linescores[1]**.
  - **Advancer = the competitor with `winner: true`**; `shootoutScore` gives the pens.
  - **Period count tells how it was decided**: 2 = regulation, 4 = extra time, 5 = penalties.
- Cost: **one extra summary fetch per KO match** (the scoreboard list is insufficient).

Extractor: `extractEspnKnockoutResult()` in `src/shared/espnKnockout.ts`
(`competitors → { scores, decidedBy }`), tested against real 2022 fixtures.

### football-data.org — backup (clean shape, but LONG, UNKNOWN LAG → cross-check only)

The `/v4/competitions/WC/matches` call the cron already makes exposes per-KO:

- **`regularTime` = the 90' score**. Absent when decided in 90' (then `fullTime` is the
  90' score). Rule: **`regularTime ?? fullTime`**.
- `fullTime` is the pens-inclusive aggregate — **never use it alone** for KO.
- `winner` (`HOME_TEAM`/`AWAY_TEAM`) = advancer; `duration` = REGULAR/EXTRA_TIME/PENALTY_SHOOTOUT.

Because the lag is long and unbounded, football-data is a **cross-check only** —
nothing time-sensitive waits on it. `/v4/matches/<id>` is restricted on the free token.

## Mapping provider events → our `matchNum`

Neither provider's id ordering matches ours, but **both expose stable per-fixture ids
before the bracket resolves**, each tied to a kickoff time. Our `matchNum`s join to both
**uniquely by kickoff UTC** (every slot has a distinct minute). So we **pre-bake** the
table `matchNum → {espnId, fdId}` and hit fixed ids — no team-pairing, no name-aliasing,
no waiting for teams.

Round of 32 (verified 2026-06-24; ESPN `.../summary?event=<espnId>`):

| matchNum | kickoff UTC | espnId | fdId |  | matchNum | kickoff UTC | espnId | fdId |
|---|---|---|---|---|---|---|---|---|
| 73 | Jun 28 19:00 | 760486 | 537417 |  | 81 | Jul 02 00:00 | 760494 | 537421 |
| 74 | Jun 29 20:30 | 760489 | 537415 |  | 82 | Jul 01 20:00 | 760493 | 537422 |
| 75 | Jun 30 01:00 | 760488 | 537418 |  | 83 | Jul 02 23:00 | 760496 | 537419 |
| 76 | Jun 29 17:00 | 760487 | 537423 |  | 84 | Jul 02 19:00 | 760497 | 537420 |
| 77 | Jun 30 21:00 | 760492 | 537416 |  | 85 | Jul 03 03:00 | 760498 | 537429 |
| 78 | Jun 30 17:00 | 760490 | 537424 |  | 86 | Jul 03 22:00 | 760500 | 537427 |
| 79 | Jul 01 01:00 | 760491 | 537425 |  | 87 | Jul 04 01:30 | 760501 | 537430 |
| 80 | Jul 01 16:00 | 760495 | 537426 |  | 88 | Jul 03 18:00 | 760499 | 537428 |

ESPN ids 760486–760501, FD ids 537415–537430 (each contiguous). Generate R16/QF/SF/3rd/
Final the same way (pull each round's scoreboard window, join by kickoff UTC) **after the
group stage** — see the caveat below.

## Build status (vertical slices)

| Slice | What | Status |
|---|---|---|
| S0 | Lock the KO draw-advancer scoring rule with tests (`computeUserPoints.test.ts`) | ✅ done |
| S1 | `parseKoScores`/`renderKoScores` in `scripts/results-file.ts` (round-trips the advancer) | ✅ done |
| S2 | `extractEspnKnockoutResult` in `src/shared/espnKnockout.ts` | ✅ done |
| S3 | Pre-baked `matchNum → {espnId, fdId}` table (R32 above) | data, R32 verified |
| S4 | Wire the cron (`scripts/fetch-scores.ts`): fetch summary for KO ids, write via S1; football-data as cross-check | parked |
| S5a | Live **display** overlay onto `knockoutStages` — running score + "חי" via the scoreboard feed, joined by `espnId` (`koEventIds.ts`). Lights up the home feed for free. | ✅ done (2026-06-28, vs live match 73) |
| S5b | Frozen-90' **scoring** overlay — per-event summary `linescores` so points stay correct through ET/pens | next |

S4 and S5b remain **parked/next**; S5a shipped against the live R32 opener. The two
open questions below still need a match that reaches ET to fully close.

## Open questions (need a real KO match to verify)

1. **Live linescores during ET** — does ESPN's summary populate `linescores`
   period-by-period while a match is in progress? Needed so the live overlay can show a
   running score while keeping the *scoring comparison frozen at the 90' figure* (a `1-1`
   prediction must not flash as "missed" once ET goals go in). The regulation score is
   periods 1+2, which are complete before ET starts, so this is lower-risk than it sounds.
2. **Event-id stability** — do ESPN/football-data **reissue the event id** when a
   placeholder slot ("Group A 2nd") is replaced by a real team? Re-pull each round's window
   after the group stage and diff the ids before trusting the pre-baked table.

## Manual fallback

Until S4 lands, a KO result can be entered by hand: add the regulation score (and
`drawWinner` for a draw) to the `koScores` block in `src/tournament-results.ts`, keyed by
`matchNum` — e.g. `79: { home: 1, away: 1, drawWinner: 'home' }`. The `koScores` block and
its `read`/`write` wrappers land with S4 (their first real consumer).

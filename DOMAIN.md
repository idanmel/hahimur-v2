# Domain Model — FIFA WC 2026 Prediction Tracker

## Score
`number | null`

A goal count for one side of a match. `null` means the user has not yet entered a prediction for that side.

---

## Team
_Source: `TEAMS` in [src/lib/groups.ts](src/lib/groups.ts)_

A national football team.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | English name — the primary identifier used throughout the codebase |
| `iso` | `string` | ISO 3166-1 alpha-2 country code, used for flag display |
| `he` | `string` | Hebrew name |

48 teams participate, divided into 12 groups of 4.

---

## Group
_Source: `GROUPS` in [src/lib/groups.ts](src/lib/groups.ts)_

One of 12 competition groups (A–L). Each group contains 4 teams playing a full round-robin (6 matches).

| Field | Type | Description |
|-------|------|-------------|
| `letter` | `GroupLetter` | Identifier A–L |
| `he` | `string` | Hebrew label (א through י"ב) |
| `matches` | `Match[]` | The 6 group-stage matches |

---

## Match
_Type: `Match` in [src/types.ts](src/types.ts)_

A scheduled game between two teams.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier composed of group letter + index (e.g. `A1`, `B3`) |
| `homeTeam` | `string` | Home team name |
| `awayTeam` | `string` | Away team name |
| `matchDate` | `string?` | Display date in Hebrew |
| `kickoffIST` | `string?` | Kickoff time in Israel Standard Time |

72 group-stage matches in total (12 groups × 6).

---

## MatchScores
_Type: `MatchScores` in [src/types.ts](src/types.ts)_

The user's predicted scoreline for a single match.

| Field | Type | Description |
|-------|------|-------------|
| `home` | `Score` | Predicted goals for the home team |
| `away` | `Score` | Predicted goals for the away team |

Both fields are `null` until the user enters a value.

---

## PredictionsState
_Type alias in [src/App.tsx](src/App.tsx)_

`Record<matchId, MatchScores>` — the user's full set of predictions across all 72 group-stage matches. Persisted to `localStorage`.

---

## Standing
_Type: `Standing` in [src/types.ts](src/types.ts)_

Computed statistics for one team within a group, derived from all predicted results in that group.

| Field | Type | Description |
|-------|------|-------------|
| `team` | `string` | Team name |
| `played` | `number` | Matches with predictions entered |
| `won` | `number` | Wins |
| `drawn` | `number` | Draws |
| `lost` | `number` | Losses |
| `goalsFor` | `number` | Goals scored |
| `goalsAgainst` | `number` | Goals conceded |
| `points` | `number` | 3 per win, 1 per draw, 0 per loss |

**Tiebreaking order within a group:**
1. Head-to-head points
2. Head-to-head goal difference
3. Head-to-head goals scored
4. _(recursively applied to any still-tied subset)_
5. Overall goal difference
6. Overall goals scored
7. Alphabetical (final fallback)

---

## ThirdPlaceStanding
_Type: `ThirdPlaceStanding` in [src/types.ts](src/types.ts)_

A `Standing` extended with `group: string` — the letter of the group the team finished third in. Used for cross-group comparison of the 12 third-place finishers.

---

## ThirdPlaceQualification
_Type: `ThirdPlaceQualification` in [src/types.ts](src/types.ts)_

The outcome of ranking all 12 third-place finishers to select the 8 who advance.

Two variants:

| Variant | Fields | Meaning |
|---------|--------|---------|
| `resolved: true` | `qualifiers: ThirdPlaceStanding[]` | 8 qualifiers determined unambiguously |
| `resolved: false` | `all: ThirdPlaceStanding[]`, `tied: ThirdPlaceStanding[]` | A tie at the cut-off that cannot be broken; `tied` lists the teams involved |

**Ranking criteria (in order):**
1. Points
2. Overall goal difference
3. Goals scored

# ההימור 2026 — FIFA WC 2026 Prediction Tracker

A friend-group prediction competition for the 2026 FIFA World Cup. Players submit score predictions for all 48 group-stage matches and the full knockout bracket. Points are awarded automatically based on results.

This is the 12th edition of a competition that has been running for 22 years.

## Stack

- **React 19** + **TypeScript** + **Vite**
- **Vitest** + **Testing Library** for unit tests
- **Deployed on Vercel** (see `vercel.json` and `.vercel/`)
- No router library — routing is done by inspecting `window.location.pathname` in `src/main.tsx`

## Pages

| Path | Component | Purpose |
|------|-----------|---------|
| `/` | `HomePage` | Welcome message and scoring rules |
| `/form` | `FormPage` | Submit or view a single player's predictions |
| `/forms` | `FormsPage` | List of all players with links to their forms |
| `/results` | `ResultsPage` | Official tournament results rendered with `FormView` |

## Project Structure

```
src/
  pages/           # Top-level page components (one folder per route)
  formView/        # Shared prediction display: group stage, knockout, third place
  shared/          # Types, standings logic, group data, reusable components
  users/           # One file per player, each exports `predictions` and `topGoalscorer`
  results.ts       # Re-exports the official results from public/results.json
public/
  results.json     # Actual match results (updated as the tournament progresses)
scripts/
  generate-allocation-matrix.py  # Generates the knockout bracket allocation matrix
```

## Adding a New Player

1. Create `src/users/<name>.ts` — export `predictions: PredictionsState` and `topGoalscorer: string`.
2. Add a link to that user's form in `FormsPage`.

## Scoring System

Three scoring events per match:

- **פגיעה** — correct result (right winner, or draw): base points
- **צליפה** — exact scoreline (supersedes פגיעה): higher points
- **עולה** — correctly predicted a team to advance to that round (derived from score predictions automatically)

| Stage | פגיעה | צליפה | עולה |
|-------|-------|-------|------|
| Group stage (per match) | 2 | 4 | 5 |
| Round of 32 | 5 | 7 | 5 |
| Round of 16 | 6 | 8 | 8 |
| Quarter-finals | 8 | 12 | 12 |
| Semi-finals | 12 | 16 | 16 |
| Third place | 16 | 18 | 20 |
| Final | 20 | 25 | 25 |

Top scorer bonus: 3 pts per goal scored by the predicted player, +10 if they win the Golden Boot.

See [SCORING.md](SCORING.md) for the full spec.

## Development

```bash
npm install
npm run dev        # dev server
npm test           # run tests once
npm run test:watch # watch mode
npm run build      # tsc + vite build
```

## How We Build

This project follows the principles in [CLAUDE.md](CLAUDE.md): vertical slices, test-first, small steps, no big-upfront design. If you're contributing or extending — read that file first.

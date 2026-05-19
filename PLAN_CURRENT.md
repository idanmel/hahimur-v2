# Prediction Submission UI — Phase Plan

## Context
Build a prediction form so friends can fill in scores for all 104 matches + top goalscorer. No auth, no persistence yet. Goal: show real people the UI and get feedback.

We build in thin vertical slices — each slice is a deployable thing a real person can react to. Start with one match, not 104.

Source data: `/home/idanmel/hahimur/FIFA_WC_2026_MATCHES.md`

---

## Stack
React + Vite + TypeScript + Vitest + React Testing Library.

Chosen for this phase only — simple, no server needed, excellent testing support.

**Key architectural boundary:** standings calculation lives in a pure TypeScript function (`calculateStandings`) with no React dependency. React only handles rendering and capturing input state. This function can move to a server, a different framework, or a shared library without rewriting.

---

## Slices

### Slice 1 — CI green ✅
**Failing tests:**
```
given the predictions page loads
then the user sees "2026 World Cup Predictions"
```
```
given a push to main
when CI runs
then all tests pass
and the app is deployed and reachable
```
**Build:** scaffold Next.js project, configure Vitest, add GitHub Actions workflow that runs tests on every push, deploy to Vercel.  
**Done when:** a push triggers CI, tests go green, and the page is live. Every subsequent slice has automated feedback from this point.

### Slice 2 — One match, fillable ✅
**Failing test:**
```
given the predictions page is open
when the user types "2" into the Mexico score
and types "1" into the South Africa score
then the Mexico score shows 2
and the South Africa score shows 1
```
**Valid input:**
```
given the user types "0" into the Mexico score
then the Mexico score shows 0
```

**Invalid input — all should leave the field empty:**
```
given the user types "-1" into the Mexico score
then the Mexico score remains empty
```
```
given the user types "1.5" into the Mexico score
then the Mexico score remains empty
```
```
given the user types "abc" into the Mexico score
then the Mexico score remains empty
```
```
given the user types "1a" into the Mexico score
then the Mexico score remains empty
```
```
given the user types " " (space) into the Mexico score
then the Mexico score remains empty
```
```
given the user types "!" into the Mexico score
then the Mexico score remains empty
```
**Build:** hardcode that one match, two number inputs with `onChange` handler that rejects anything that is not a non-negative integer.  
**Deploy + show someone.** Does the concept make sense? Is the input clear?

### Slice 3a — `calculateStandings` pure function ✅
The group standings table mirrors the Wikipedia format with columns: Pos, Team, Pld, W, D, L, GF, GA, GD, Pts.

**Failing tests** (no UI, no rendering):
```
given Mexico scored 2 and South Africa scored 1
when standings are calculated for Group A
then Mexico:       Pld=1, W=1, D=0, L=0, GF=2, GA=1, GD=+1, Pts=3
and  South Africa: Pld=1, W=0, D=0, L=1, GF=1, GA=2, GD=-1, Pts=0
```
```
given South Africa scored 2 and Mexico scored 0
when standings are calculated for Group A
then South Africa: Pld=1, W=1, D=0, L=0, GF=2, GA=0, GD=+2, Pts=3
and  Mexico:       Pld=1, W=0, D=0, L=1, GF=0, GA=2, GD=-2, Pts=0
```
```
given Mexico scored 1 and South Africa scored 1
when standings are calculated for Group A
then Mexico:       Pld=1, W=0, D=1, L=0, GF=1, GA=1, GD=0,  Pts=1
and  South Africa: Pld=1, W=0, D=1, L=0, GF=1, GA=1, GD=0,  Pts=1
```
```
given no score has been entered for Mexico vs South Africa
when standings are calculated for Group A
then all teams have Pld=0 (incomplete predictions do not count)
```
```
given only Mexico's score has been entered (South Africa's is missing)
when standings are calculated for Group A
then all teams have Pld=0 (partial predictions do not count)
```
```
given all 4 teams have no predictions entered
when standings are calculated for Group A
then all teams have Pld=0, W=0, D=0, L=0, GF=0, GA=0, GD=0, Pts=0
```
**Build:** implement `calculateStandings(matches: Match[], predictions: Prediction[]): Standing[]` as a pure TypeScript function.

### Slice 3b — Group table rendered in UI ✅
**Failing tests:**
```
given the predictions page is open
then the group A standings table is visible with all 4 teams
```
```
given the predictions page is open
when the user types "2" into the Mexico score and "1" into the South Africa score
then the group table updates to reflect the new standings
```
```
given the predictions page is open
when the user changes a previously entered score
then the group table updates immediately
```
**Build:** wire `calculateStandings` into the UI. Score inputs feed into React state, standings table re-renders on every change.  
**Deploy + show someone.** This is the first slice that feels like a real product.

### Slice 4 — Group A (6 matches) *(draft)*
**Failing test:**
```
given the predictions page is open
then the user sees all 6 Group A matches
and the group table updates as scores are entered
```
**Build:** introduce `matches.ts` with Group A data. Loop and render `<MatchRow>` per match, standings recalculate from all 6.  
**Deploy + show someone.** Is the grouping clear? Is it overwhelming?

### Slice 5 — All 12 groups (72 matches) *(draft)*
**Failing test:**
```
given the predictions page is open
then the user sees all 12 group sections
and each group has its own standings table
```
**Build:** complete `matches.ts` with all group stage data. Add `<GroupSection>` component.  
**Deploy + show someone.**

### Slice 6 — Knockout matches (104 total) *(draft)*
**Failing test:**
```
given the predictions page is open
then the user sees "Round of 32" and "Final" sections
and can enter scores for all 32 knockout matches
```
**Build:** add knockout matches to `matches.ts`. Render as separate stage sections.  
**Deploy + show someone.**

### Slice 7 — Top goalscorer *(draft)*
**Failing test:**
```
given the predictions page is open
when the user scrolls to the bottom
then they see a player name field and a team field
```
**Build:** add `<TopScorerForm>` below the match list.  
**Deploy + show someone.** Full phase goal is now met.

---

## Files (Slices 1–3 only)

```
src/
  main.tsx                  # Vite entry point
  App.tsx                   # predictions state (useState), renders everything
  lib/
    groups.ts               # Group A teams — just 4 strings for now
    standings.ts            # calculateStandings pure function
  components/
    MatchRow.tsx             # two score inputs, calls onChange
    StandingsTable.tsx       # renders standings from calculateStandings output
```

**State shape** (lives in `App.tsx`):
```ts
{ [matchId]: { home: number | null, away: number | null } }
```

Passed down as props. No context, no Redux, no routing, no data fetching.

**`groups.ts` is separate from match data** — `calculateStandings` needs to know all 4 teams to show them at 0 before any predictions are entered; it can't derive that from matches alone.

Files will grow in later slices (matches.ts, GroupSection.tsx, etc.) but nothing built in slices 1–3 needs to be rewritten to support that.

---

## Before starting each slice, ask:
> "What is the smallest thing I can build that will teach us something we don't already know?"

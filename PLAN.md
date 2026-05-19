# Plan: FIFA World Cup 2026 Betting Tracker Web App

## TL;DR
Build a web app where ~25 friends submit soccer predictions (exact scores, correct outcomes, team advances) for all 64 World Cup matches before the tournament starts. Once matches begin, an admin updates actual results, and the app auto-calculates points using the custom scoring rules and displays a live leaderboard.

**Recommended tech stack:** 
- Frontend: React (or Next.js for simpler deployment)
- Backend: Node.js + Express
- Database: MongoDB or Firebase (free tier works for 25 users)
- Hosting: Vercel or Netlify (frontend) + serverless functions (backend)

---

## Scoring Rules (Corrected)

**For each match, predict:**
1. **Exact Score** — score of the match
2. **Correct Outcome** — which team wins
3. **Advance (עולה)** — which team advances to next round

### Group Stage
- Exact Score: 4 pts | Correct Outcome: 2 pts | Correct Advance: 5 pts

### Round 1 (Knockout)
- Exact Score: 7 pts | Correct Outcome: 5 pts | Correct Advance: 5 pts

### Round of 16
- Exact Score: 8 pts | Correct Outcome: 6 pts | Correct Advance: 8 pts

### Quarter-finals
- Exact Score: 12 pts | Correct Outcome: 8 pts | Correct Advance: 12 pts

### Semi-finals
- Exact Score: 16 pts | Correct Outcome: 12 pts | Correct Advance: 16 pts

### 3rd Place Match
- Exact Score: 18 pts | Correct Outcome: 16 pts | Winner bonus: 20 pts

### Final
- Exact Score: 25 pts | Correct Outcome: 20 pts | Winner bonus: 25 pts

### Top Scorer
- Per goal predicted correctly: 3 pts | If you correctly predict the top scorer: +10 pts

---

## Implementation Steps

### Phase 1: Setup & Database Schema (1-2 days)
1. Create project structure (React frontend + Express backend)
2. Design database schema:
   - **Users** (id, name, email, predictions[])
   - **Matches** (id, stage, team1, team2, predictedResults[], actualResult)
   - **Predictions** (userId, matchId, predictedExactScore, predictedOutcome, predictedAdvance)
   - **Scores** (userId, totalScore, scoreBreakdown[])
3. Set up authentication (simple: email/password or one-time link for ~25 players)
4. Deploy empty app to hosting (e.g., Vercel)

### Phase 2: Prediction Submission (2-3 days)
1. Build prediction form component (for each match: exact score, correct outcome, winner)
2. Create submission UI with match list (all 64 matches grouped by stage)
3. Add validation (predictions only accepted before tournament start date)
4. Build backend API: `POST /api/predictions/submit`
5. Add user preview page to review/edit own predictions

### Phase 3: Admin Dashboard (2-3 days)
1. Build admin interface (restrict to designated admins)
2. Create form to input actual match results (exact score, correct outcome, advancing team)
3. Backend API: `POST /api/matches/:id/result` (updates actual results)
4. Trigger auto-recalculation of all scores when results posted

### Phase 4: Scoring Engine & Leaderboard (2-3 days)
1. Implement scoring logic:
   - Match predicted vs. actual for each match
   - Award points per stage-specific rules
   - Calculate top scorer points separately
   - Sum to user total score
2. Build leaderboard component (sorted by total score, show breakdowns)
3. Add filtering (by stage: group, round of 16, etc.)
4. Backend: `GET /api/leaderboard` (returns ranked users + scores)

### Phase 5: Polish & Testing (1-2 days)
1. Mobile responsiveness (many friends will check on phones)
2. Error handling & edge cases (tied goals, disqualifications)
3. Performance testing with 25 concurrent users
4. Test all scoring calculations against a few manual examples

---

## Relevant Files (to be created)
- `/frontend/components/PredictionForm.jsx` — Match prediction input form
- `/frontend/pages/Leaderboard.jsx` — Live standings display
- `/frontend/pages/AdminDashboard.jsx` — Result entry interface
- `/backend/api/predictions.js` — Prediction submission endpoints
- `/backend/api/matches.js` — Match result endpoints
- `/backend/utils/scoring.js` — Core scoring logic (all calculations here)
- `/backend/models/User.js`, `Match.js`, `Prediction.js` — Database schemas
- `/backend/middleware/auth.js` — User authentication

---

## Verification
1. **Prediction submission test:** 25 test users submit predictions for 5 sample matches → verify all data saved correctly
2. **Scoring test:** Manually input 1 match result → verify points calculated correctly for all prediction combinations
3. **Leaderboard test:** Check leaderboard orders users correctly and shows stage breakdowns
4. **Edge cases:** Test tied goals, advancing team scored no goals, top scorer from eliminated team
5. **Admin restriction:** Verify non-admins cannot access admin dashboard or post results
6. **Mobile UI:** Test leaderboard and prediction form on mobile device

---

## Decisions
- **Web app over spreadsheet:** Scales better for 25 players, auto-calculation reduces errors, better UX
- **Predictions before tournament:** Simpler to manage, locks predictions to prevent post-hoc changes
- **Admin-driven result updates:** One trusted person inputs actual results; simpler than crowdsourced data
- **Staging: All-in-one vs. incremental:** Build in phases so feedback can be gathered early

---

## Final Clarifications
- **Tied scores:** Players with identical final scores share the same placement (no additional tie-breaker logic)
- **Late entries:** Not allowed — only friends who register before tournament start can participate
- **Notifications:** Not needed — leaderboard checked manually

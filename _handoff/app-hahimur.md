# Handoff — אפליקציית hahimur-v2

> צרף קובץ זה (`@app-hahimur.md`) בתחילת צ'אט ייעודי לשינויי אפליקציה.

## מה זה
אתר הפול (React + TypeScript + Vite). מוגש server-rendered? לא — SPA שנפרס (יש `vercel.json`).

## מבנה
- `src/` — קוד האפליקציה (pages, leaderboard, formView, shared, users)
- `scripts/` — סקריפטי עדכון נתונים (fetch-scores, update-results, update-scorers...)
- `public/` — נכסים סטטיים (`updates.json`)
- כלי משחק 1 (winprob/sim/history/server וכו') יושבים ב‑**root** — לא חלק מהאפליקציה.

## תהליך עבודה (חובה)
- בדיקות: `npx vitest run` — חייבות לעבור (יש ~526 בדיקות).
- בנייה: `npm run build`.
- Shell = **PowerShell**: אין `&&`, אין heredoc. הודעות commit דרך `git commit -F <file>`.
- הריפו משותף: `idanmel/hahimur-v2`. אתה collaborator (`LiorMoldovan`) — ה‑push עובד אחרי שאישרת את ההזמנה.
- **עידן דוחף גם הוא** (עדכוני תוצאות אוטומטיים + פיצ'רים). תמיד `git fetch` + `rebase` לפני push, וצפה לקונפליקטים אם עבדתם על אותו אזור.
- אל תדחוף בלי בקשה מפורשת; אל תכלול בקבצי commit את כלי הניתוח המקומיים מה‑root.

## עבודה אחרונה (commit 813e13e, נדחף)
- דף סטטיסטיקות בתים: בורר בתים קבוע (`GroupPicker`) + שם הבית בכותרת
- לוח: פאנל אלופה/מלך שערים בלחיצה (גרסת עידן, `PicksPanel`) + **עמודות סבב במובייל** (שלב הבתים + מלך שערים)
- דף ניחושים: גלילה אוטומטית למשחק הקרוב בתצוגת תאריכים

## הערה
הצ'אט הקודם רץ בטעות מ‑workspace של "OCP HW Manager". מעכשיו עבוד מתוך workspace של `hahimur-v2`.

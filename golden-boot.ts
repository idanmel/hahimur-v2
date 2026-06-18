/**
 * מודל מלך השערים (ניתן לעריכה).
 *
 * לכל כובש מועמד: השם (חייב להתאים בדיוק לשדה topGoalscorer של השחקנים),
 * הנבחרת שלו, וקצב גולים למשחק (ratePerMatch).
 *
 * בסימולציה: מספר המשחקים שהכובש משחק = 3 (בית) + כמה משחקי נוקאאוט הנבחרת שלו
 * הגיעה אליהם באותה ריצה. גולים ~ Poisson(rate × matches). מי שצובר הכי הרבה
 * הוא מלך השערים באותה ריצה. כך נבחרת שמעמיקה בטורניר נותנת לכובש שלה יותר גולים.
 *
 * הרשימה כוללת גם כובשים שאף אחד לא בחר (הולנד, מסי, רונאלדו...) — הם משפיעים על מי
 * *זוכה* בתואר, ולכן מורידים באופן הוגן את סיכויי הבונוס של הבחירות הפופולריות.
 *
 * הקצבים הם הערכות סבירות — ערוך אותן אם יש לך דעה אחרת.
 */
export interface ScorerCandidate { name: string; team: string; ratePerMatch: number }

export const SCORERS: ScorerCandidate[] = [
  // ---- כובשים שנבחרו ע"י מתמודדים (השמות חייבים להתאים בדיוק) ----
  { name: 'קיליאן אמבפה',   team: 'France',  ratePerMatch: 0.80 },
  { name: 'הארי קיין',       team: 'England', ratePerMatch: 0.72 },
  { name: 'ויניסיוס ג׳וניור', team: 'Brazil',  ratePerMatch: 0.58 },
  { name: 'לאמין ימאל',      team: 'Spain',   ratePerMatch: 0.52 },
  { name: 'פראן טורס',       team: 'Spain',   ratePerMatch: 0.45 },
  { name: 'פלוריאן וירץ',    team: 'Germany', ratePerMatch: 0.40 },
  { name: 'קאי האברץ',       team: 'Germany', ratePerMatch: 0.42 },

  // ---- מתחרים מובילים שלא נבחרו (משפיעים על הזוכה בתואר) ----
  { name: 'ארלינג הולנד',    team: 'Norway',    ratePerMatch: 0.85 },
  { name: 'ליאו מסי',        team: 'Argentina', ratePerMatch: 0.50 },
  { name: 'חוליאן אלברס',    team: 'Argentina', ratePerMatch: 0.55 },
  { name: 'לאוטרו מרטינס',   team: 'Argentina', ratePerMatch: 0.48 },
  { name: 'כריסטיאנו רונאלדו', team: 'Portugal', ratePerMatch: 0.58 },
  { name: 'רפיניה',          team: 'Brazil',    ratePerMatch: 0.48 },
]

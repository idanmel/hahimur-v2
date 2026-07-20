import { TEAM_BY_PICKED } from '../../shared/scorers'

// Latin (ESPN athlete displayName) -> Hebrew, for UNPICKED players shown on the
// Golden Boot race board only.
//
// Deliberately SEPARATE from SCORER_ALIASES in shared/espnLive.ts: names there
// feed picked players' live goals into tournamentResults.playerGoals (and from
// there into points, the win-prob sim, Records, etc.). Adding an unpicked name
// to that map would leak an uninvolved player into all of it. This map is
// display-only — it never touches playerGoals.
//
// Curate the current real leaders/chasers here. An uncurated player who reaches
// (or nears) the lead falls back to their Latin name on the board rather than
// being dropped, so we never silently misreport the race; add the Hebrew here
// and it swaps in on the next load.
export const GOLDEN_BOOT_NAMES: Record<string, string> = {
  'Lionel Messi': 'ליאו מסי',
  'Erling Haaland': 'ארלינג הולאנד',
  'Jude Bellingham': 'ג׳וד בלינגהאם',
  'Julián Quiñones': 'חוליאן קיניונס',
  'Julián Álvarez': 'חוליאן אלברס',
  'Cristiano Ronaldo': 'כריסטיאנו רונאלדו',
  'Ousmane Dembélé': 'עוסמאן דמבלה',
  'Randal Kolo Muani': 'רנדל קולו מואני',
  'Victor Osimhen': 'ויקטור אוסימחן',
  'Mohamed Salah': 'מוחמד סלאח',
  'Robert Lewandowski': 'רוברט לבנדובסקי',
  'Mikel Oyarzabal': 'מיקל אויארסבאל',
  'Ismaïla Sarr': 'איסמעילה סאר',
}

// Hebrew display name (exactly as a race-board row is keyed) -> the player's
// national team, using our internal team names (shared/groups.ts). Covers picked
// players plus the curated unpicked contenders in GOLDEN_BOOT_NAMES.
//
// Used to spot a player whose team has no match left to play while they trail the
// lead — a player whose team is done playing can't add goals, so if they're already
// behind they can never (co-)win the Golden Boot. (Eliminated alone isn't enough:
// a semi-final loser still plays the third-place match.) For a PICKED player that
// shows the "מחוץ למירוץ"
// badge; an UNPICKED one is dropped from the board entirely (nobody's points
// depend on him). A player missing here (e.g. an uncurated Latin-fallback row) is
// simply never marked out — we never report a false elimination.
export const TEAM_BY_PLAYER: Record<string, string> = {
  // picked players come from the registry, so a name can't drift from the
  // one points and live goals are keyed by
  ...TEAM_BY_PICKED,
  // curated unpicked contenders
  'ליאו מסי': 'Argentina',
  'ארלינג הולאנד': 'Norway',
  'ג׳וד בלינגהאם': 'England',
  'חוליאן קיניונס': 'Mexico',
  'חוליאן אלברס': 'Argentina',
  'כריסטיאנו רונאלדו': 'Portugal',
  'עוסמאן דמבלה': 'France',
  'רנדל קולו מואני': 'France',
  'ויקטור אוסימחן': 'Nigeria',
  'מוחמד סלאח': 'Egypt',
  'רוברט לבנדובסקי': 'Poland',
  'מיקל אויארסבאל': 'Spain',
  'איסמעילה סאר': 'Senegal',
}

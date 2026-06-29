import type { MatchScores } from './types'
// Explicit .ts extensions on the value imports below so this module also resolves
// under plain `node` (the cron runs `node scripts/fetch-scores.ts`, which imports
// this for orientation). Type-only imports are erased, so they need no extension.
import { tournamentResults } from '../tournament-results.ts'
import { allKO } from '../formView/knockout/koRounds.ts'

// Orienting a knockout score is shared by two callers: the live overlay
// (src/shared/espnLive.ts → useLiveScores) and the cron (scripts/fetch-scores.ts).
// Both recover a regulation (90') score from ESPN's per-event summary, which lists
// home/away in ESPN's order — this module flips it into our bracket's orientation,
// the only orientation the scoring engine (koMatchPoints) compares against.

// ESPN team names → the names used in shared/groups.ts, for matching a knockout
// fixture's sides against our bracket. A local copy (mirrors espnLive's) so this
// pure mapping module stays standalone.
const NAME_ALIASES: Record<string, string> = {
  'Korea Republic': 'South Korea',
  Czechia: 'Czech Republic',
  Türkiye: 'Turkey',
  USA: 'United States',
  'IR Iran': 'Iran',
  "Côte d'Ivoire": 'Ivory Coast',
  'Cape Verde Islands': 'Cape Verde',
  'Congo DR': 'DR Congo',
  'Bosnia-Herzegovina': 'Bosnia and Herzegovina',
}

function canonical(name: string | null): string | null {
  return name == null ? null : NAME_ALIASES[name] ?? name
}

// matchNum → canonicalised fixture teams, used only to orient a knockout score
// (ESPN may list home/away the other way round from our bracket). Built from the
// baked knockout stages; later-round placeholders just won't match a real team, so
// orientation falls back to ESPN's own order.
const koFixtures = new Map<number, { home: string | null; away: string | null }>()
for (const m of allKO(tournamentResults.knockoutStages)) {
  koFixtures.set(m.matchNum, { home: canonical(m.home), away: canonical(m.away) })
}

// Whether ESPN lists this knockout fixture's home/away the reverse of our bracket
// — same rule resolveMatch uses for the running score. Lets a regulation score
// recovered from the (ESPN-oriented) summary be flipped into our bracket's
// orientation, which is what the scoring engine (koMatchPoints) compares against.
export function isKoReversed(
  matchNum: number,
  espnHome: string | null,
  espnAway: string | null,
): boolean {
  const fixture = koFixtures.get(matchNum)
  const home = canonical(espnHome)
  const away = canonical(espnAway)
  return !!fixture && away != null && away === fixture.home && home !== fixture.home
}

// Flip a knockout regulation score into the opposite home/away orientation,
// carrying the advancer with it. A no-op when not reversed.
export function orientKoScore(scores: MatchScores, reversed: boolean): MatchScores {
  if (!reversed) return scores
  const flipped: MatchScores = { home: scores.away, away: scores.home }
  if (scores.drawWinner) flipped.drawWinner = scores.drawWinner === 'home' ? 'away' : 'home'
  return flipped
}

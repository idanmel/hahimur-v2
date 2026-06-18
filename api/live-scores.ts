import type { VercelRequest, VercelResponse } from '@vercel/node'

// Self-contained on purpose: this function imports nothing from src so it stays
// a dumb ESPN proxy and can't affect the app's build graph. All score/scorer
// mapping happens client-side in src/shared/espnLive.ts.

const GROUP_STAGE_DATES = '20260611-20260628'
const ESPN_URL = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${GROUP_STAGE_DATES}&limit=200`

interface SlimEvent {
  state: string
  completed: boolean
  home: string | null
  away: string | null
  homeScore: number | null
  awayScore: number | null
  scorers: string[]
}

interface EspnCompetitor {
  homeAway?: string
  score?: string
  team?: { displayName?: string }
}

interface EspnScoringPlay {
  scoringPlay?: boolean
  ownGoal?: boolean
  athletesInvolved?: { displayName?: string }[]
}

interface EspnEvent {
  status?: { type?: { state?: string; completed?: boolean } }
  competitions?: { competitors?: EspnCompetitor[]; details?: EspnScoringPlay[] }[]
}

function toScore(raw: string | undefined): number | null {
  const n = parseInt(raw ?? '', 10)
  return Number.isNaN(n) ? null : n
}

function slimEvent(e: EspnEvent): SlimEvent | null {
  const comp = e.competitions?.[0]
  if (!comp) return null
  const competitors = comp.competitors ?? []
  const home = competitors.find(c => c.homeAway === 'home')
  const away = competitors.find(c => c.homeAway === 'away')
  if (!home || !away) return null

  const scorers: string[] = []
  for (const play of comp.details ?? []) {
    if (!play.scoringPlay || play.ownGoal) continue
    for (const ath of play.athletesInvolved ?? []) {
      if (ath?.displayName) scorers.push(ath.displayName)
    }
  }

  return {
    state: e.status?.type?.state ?? 'pre',
    completed: !!e.status?.type?.completed,
    home: home.team?.displayName ?? null,
    away: away.team?.displayName ?? null,
    homeScore: toScore(home.score),
    awayScore: toScore(away.score),
    scorers,
  }
}

// Test/dev hook: ?fake=England:1-0:Croatia&fakeScorer=Harry%20Kane simulates a
// live match without a real game, so the overlay can be exercised end-to-end.
function fakeEvent(spec: string, scorer: string | undefined): SlimEvent | null {
  const m = spec.match(/^(.+):(\d+)-(\d+):(.+)$/)
  if (!m) return null
  return {
    state: 'in',
    completed: false,
    home: m[1],
    away: m[4],
    homeScore: parseInt(m[2], 10),
    awayScore: parseInt(m[3], 10),
    scorers: scorer ? [scorer] : [],
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const fetchedAt = new Date().toISOString()

  const fake = req.query.fake
  if (typeof fake === 'string') {
    const scorer = typeof req.query.fakeScorer === 'string' ? req.query.fakeScorer : undefined
    const event = fakeEvent(fake, scorer)
    return res.status(200).json({ events: event ? [event] : [], fetchedAt })
  }

  try {
    // Hard timeout so a slow/hanging upstream (e.g. behind a corporate proxy)
    // can never leave the request — and the caller's connection — open forever.
    const upstream = await fetch(ESPN_URL, { signal: AbortSignal.timeout(8000) })
    if (!upstream.ok) {
      return res.status(200).json({ events: [], fetchedAt, error: `ESPN ${upstream.status}` })
    }
    const { events } = (await upstream.json()) as { events?: EspnEvent[] }
    const slim = (events ?? []).map(slimEvent).filter((e): e is SlimEvent => e !== null)
    // Short shared CDN cache so heavy viewing hits ESPN at most ~once per 30s.
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=30')
    return res.status(200).json({ events: slim, fetchedAt })
  } catch (err) {
    // Never break the client: an empty overlay just means "no live data".
    return res.status(200).json({ events: [], fetchedAt, error: String(err) })
  }
}

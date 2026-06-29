import { nextMatches, recentCards, topPrediction, upcomingCards, koTopPrediction } from './nextMatch'
import { makeUser } from '../../leaderboard/testFixtures'
import type { GroupMatch, KnockoutMatch } from '../../shared/types'

// Kickoffs are Israel time (UTC+3):
//   A1 -> 11 Jun 19:00Z
//   A2 -> 12 Jun 02:00Z
//   B1 -> 12 Jun 17:00Z
//   C1 -> 13 Jun 19:00Z
//   D1 -> 14 Jun 19:00Z
//   E1 -> 15 Jun 19:00Z
const MATCHES: GroupMatch[] = [
  { id: 'A1', homeTeam: 'Mexico', awayTeam: 'South Africa', matchDate: '11 ביוני', kickoffIST: '22:00' },
  { id: 'A2', homeTeam: 'South Korea', awayTeam: 'Czech Republic', matchDate: '12 ביוני', kickoffIST: '05:00' },
  { id: 'B1', homeTeam: 'Canada', awayTeam: 'Bosnia and Herzegovina', matchDate: '12 ביוני', kickoffIST: '20:00' },
  { id: 'C1', homeTeam: 'Qatar', awayTeam: 'Ecuador', matchDate: '13 ביוני', kickoffIST: '22:00' },
  { id: 'D1', homeTeam: 'Belgium', awayTeam: 'Egypt', matchDate: '14 ביוני', kickoffIST: '22:00' },
  { id: 'E1', homeTeam: 'France', awayTeam: 'Senegal', matchDate: '15 ביוני', kickoffIST: '22:00' },
]

const ids = (matches: GroupMatch[]) => matches.map(m => m.id)

test('nextMatches returns every match within 15h of the closest, across calendar days', () => {
  // Before the tournament A1 (11th 22:00) is closest. A2 (12th 05:00, +7h) falls
  // inside the 15h window though on the next calendar day; B1 (12th 20:00, +22h)
  // and C1 (13th) are further out and excluded.
  const now = new Date('2026-06-10T12:00:00Z')
  expect(ids(nextMatches(MATCHES, now))).toEqual(['A1', 'A2'])
})

test('nextMatches drops a match more than 15h after the closest one', () => {
  // X is closest; Y kicks off 14h later (in), Z 16h later (out).
  const spread: GroupMatch[] = [
    { id: 'X', homeTeam: 'A', awayTeam: 'B', matchDate: '11 ביוני', kickoffIST: '12:00' }, // 11 Jun 09:00Z
    { id: 'Y', homeTeam: 'C', awayTeam: 'D', matchDate: '12 ביוני', kickoffIST: '02:00' }, // +14h
    { id: 'Z', homeTeam: 'E', awayTeam: 'F', matchDate: '12 ביוני', kickoffIST: '04:00' }, // +16h
  ]
  const now = new Date('2026-06-11T00:00:00Z')
  expect(ids(nextMatches(spread, now))).toEqual(['X', 'Y'])
})

test('nextMatches returns matches in chronological order regardless of source order', () => {
  const now = new Date('2026-06-10T12:00:00Z')
  const shuffled = [MATCHES[2], MATCHES[1], MATCHES[0]]
  expect(ids(nextMatches(shuffled, now))).toEqual(['A1', 'A2'])
})

test('nextMatches keeps a match in progress until its score is recorded', () => {
  const now = new Date('2026-06-11T20:00:00Z') // A1 kicked off at 19:00Z, no score yet
  expect(nextMatches(MATCHES, now)[0].id).toBe('A1')
})

test('nextMatches drops a started match once it has a final score', () => {
  const matches: GroupMatch[] = [
    { ...MATCHES[0], scores: { home: 2, away: 1 } },
    ...MATCHES.slice(1),
  ]
  const now = new Date('2026-06-11T20:00:00Z')
  expect(nextMatches(matches, now)[0].id).toBe('A2')
})

test('nextMatches keeps a scoreless match through a long delay (still inside the window)', () => {
  const now = new Date('2026-06-11T23:30:00Z') // A1 kicked off at 19:00Z, 4.5h ago and rain-delayed
  expect(nextMatches(MATCHES, now)[0].id).toBe('A1')
})

test('nextMatches gives up on a scoreless match once the window has passed', () => {
  const now = new Date('2026-06-12T01:30:00Z') // A1 kicked off at 19:00Z, 6.5h ago, fetcher never delivered
  expect(nextMatches(MATCHES, now)[0].id).toBe('A2')
})

test('nextMatches returns empty when no match remains', () => {
  const now = new Date('2026-06-20T12:00:00Z')
  expect(nextMatches(MATCHES, now)).toEqual([])
})

test('nextMatches returns both matches of a simultaneous kickoff', () => {
  const round3: GroupMatch[] = [
    { id: 'A3', homeTeam: 'Czech Republic', awayTeam: 'South Africa', matchDate: '24 ביוני', kickoffIST: '22:00' },
    { id: 'A4', homeTeam: 'Mexico', awayTeam: 'South Korea', matchDate: '24 ביוני', kickoffIST: '22:00' },
  ]
  const now = new Date('2026-06-24T12:00:00Z')
  expect(ids(nextMatches(round3, now))).toEqual(['A3', 'A4'])
})

test('nextMatches drops a tied match once its score is in but keeps the other', () => {
  const round3: GroupMatch[] = [
    { id: 'A3', homeTeam: 'Czech Republic', awayTeam: 'South Africa', matchDate: '24 ביוני', kickoffIST: '22:00', scores: { home: 1, away: 0 } },
    { id: 'A4', homeTeam: 'Mexico', awayTeam: 'South Korea', matchDate: '24 ביוני', kickoffIST: '22:00' },
  ]
  const now = new Date('2026-06-24T20:00:00Z') // both kicked off at 19:00Z, only A3 has a score
  expect(ids(nextMatches(round3, now))).toEqual(['A4'])
})

// Mirror of nextMatches: the last few matches that already have a final score,
// most recent first. Built from the same fixture, with scores filled in.
const SCORED: GroupMatch[] = MATCHES.map(m => ({ ...m, scores: { home: 1, away: 0 } }))

const cardIds = (cards: { match: GroupMatch }[]) => cards.map(c => c.match.id)

test('recentCards returns every played match within 15h of the most recent, newest first', () => {
  // R1 (13th 02:00) is the most recent; R2 (12th 20:00, -6h) falls inside the
  // 15h window though on the previous calendar day; R0 (12th 05:00, -21h) is a
  // full day out and excluded.
  const recent: GroupMatch[] = [
    { id: 'R0', homeTeam: 'A', awayTeam: 'B', matchDate: '12 ביוני', kickoffIST: '05:00', scores: { home: 1, away: 0 } },
    { id: 'R2', homeTeam: 'C', awayTeam: 'D', matchDate: '12 ביוני', kickoffIST: '20:00', scores: { home: 1, away: 0 } },
    { id: 'R1', homeTeam: 'E', awayTeam: 'F', matchDate: '13 ביוני', kickoffIST: '02:00', scores: { home: 1, away: 0 } },
  ]
  const now = new Date('2026-06-13T03:00:00Z')
  expect(cardIds(recentCards(recent, [], now))).toEqual(['R1', 'R2'])
})

test('recentCards ignores matches without a final score', () => {
  // M (12th 14:00) sits inside L's 15h window but has no score, so only K and L
  // show — K (12th 08:00) is settled and inside the window.
  const matches: GroupMatch[] = [
    { id: 'K', homeTeam: 'A', awayTeam: 'B', matchDate: '12 ביוני', kickoffIST: '08:00', scores: { home: 2, away: 1 } },
    { id: 'M', homeTeam: 'C', awayTeam: 'D', matchDate: '12 ביוני', kickoffIST: '14:00' },
    { id: 'L', homeTeam: 'E', awayTeam: 'F', matchDate: '12 ביוני', kickoffIST: '20:00', scores: { home: 0, away: 0 } },
  ]
  const now = new Date('2026-06-13T00:00:00Z')
  expect(cardIds(recentCards(matches, [], now))).toEqual(['L', 'K'])
})

test('recentCards only counts matches whose kickoff has passed', () => {
  // At noon on the 12th only A1 and A2 have kicked off; B1 (20:00) is still to
  // come. A2 is the most recent, with A1 (-7h) inside its 15h window.
  const now = new Date('2026-06-12T12:00:00Z')
  expect(cardIds(recentCards(SCORED, [], now))).toEqual(['A2', 'A1'])
})

test('recentCards returns empty before any match is settled', () => {
  const now = new Date('2026-06-10T12:00:00Z')
  expect(recentCards(SCORED, [], now)).toEqual([])
})

test('topPrediction returns the most common predicted score and its count', () => {
  const users = [
    makeUser({ predictions: { A2: { home: 2, away: 1 } } }),
    makeUser({ predictions: { A2: { home: 2, away: 1 } } }),
    makeUser({ predictions: { A2: { home: 0, away: 0 } } }),
    makeUser({ predictions: {} }),
  ]
  expect(topPrediction(users, 'A2')).toEqual({ home: 2, away: 1, count: 2, total: 3 })
})

test('topPrediction returns null when nobody predicted the match', () => {
  expect(topPrediction([makeUser()], 'A2')).toBeNull()
})

// Knockout fixtures join the upcoming feed once the groups are done.
// Match 73 (the R32 opener) kicks off 28 June 22:00 IST (19:00Z).
const KO_OPENER: KnockoutMatch = {
  matchNum: 73, home: 'South Korea', away: 'Canada', resolved: true,
  matchDate: '28 ביוני', kickoffIST: '22:00',
}

test('upcomingCards rolls into the knockouts once the group stage is over', () => {
  const now = new Date('2026-06-28T18:00:00Z') // an hour before the R32 opener
  const cards = upcomingCards([], [KO_OPENER], now)
  expect(cards.map(c => c.match.id)).toEqual(['73'])
  expect(cards[0].match.homeTeam).toBe('South Korea')
  expect(cards[0].heading).toBe('שלב ה-32') // round label, not a group letter
  expect(cards[0].ko).toBe(KO_OPENER)
})

test('upcomingCards keeps unresolved knockout fixtures out of the feed', () => {
  const placeholder: KnockoutMatch = {
    matchNum: 89, home: 'מנצחת 73', away: 'מנצחת 74', resolved: false,
    matchDate: '5 ביולי', kickoffIST: '00:00',
  }
  const now = new Date('2026-07-04T18:00:00Z')
  expect(upcomingCards([], [placeholder], now)).toEqual([])
})

test('upcomingCards merges group and knockout fixtures in kickoff order', () => {
  // A late group match the evening before the R32 opener shares its 15h burst.
  const lateGroup: GroupMatch = { id: 'L6', homeTeam: 'Mexico', awayTeam: 'Canada', matchDate: '28 ביוני', kickoffIST: '17:00' }
  const now = new Date('2026-06-28T13:00:00Z')
  const cards = upcomingCards([lateGroup], [KO_OPENER], now)
  expect(cards.map(c => c.match.id)).toEqual(['L6', '73'])
})

test('recentCards rolls a played knockout fixture into the results feed', () => {
  const played: KnockoutMatch = { ...KO_OPENER, scores: { home: 0, away: 1 } }
  const now = new Date('2026-06-28T21:00:00Z') // two hours after the R32 opener kicked off
  const cards = recentCards([], [played], now)
  expect(cards.map(c => c.match.id)).toEqual(['73'])
  expect(cards[0].heading).toBe('שלב ה-32') // round label, not a group letter
  expect(cards[0].ko).toBe(played)
})

test('recentCards keeps a knockout fixture without a final score out of the results feed', () => {
  const now = new Date('2026-06-28T21:00:00Z')
  expect(recentCards([], [KO_OPENER], now)).toEqual([]) // KO_OPENER has no scores yet
})

test('recentCards merges played group and knockout fixtures newest first', () => {
  const played: KnockoutMatch = { ...KO_OPENER, scores: { home: 0, away: 1 } } // 28 Jun 19:00Z
  const earlierGroup: GroupMatch = { id: 'L6', homeTeam: 'Mexico', awayTeam: 'Canada', matchDate: '28 ביוני', kickoffIST: '17:00', scores: { home: 1, away: 1 } } // -2h
  const now = new Date('2026-06-28T21:00:00Z')
  const cards = recentCards([earlierGroup], [played], now)
  expect(cards.map(c => c.match.id)).toEqual(['73', 'L6'])
})

test('koTopPrediction tallies the popular score by the teams that actually met', () => {
  const r32 = (scores: { home: number; away: number }) => ({
    r32: [{ matchNum: 73, home: 'South Korea', away: 'Canada', resolved: true, scores }],
    r16: [], qf: [], sf: [], thirdPlace: [], final: [],
  })
  const users = [
    makeUser({ knockoutStages: r32({ home: 2, away: 1 }) }),
    makeUser({ knockoutStages: r32({ home: 2, away: 1 }) }),
    makeUser({ knockoutStages: r32({ home: 0, away: 0 }) }),
    makeUser(), // predicted a different bracket → not in this match
  ]
  expect(koTopPrediction(users, KO_OPENER)).toEqual({ home: 2, away: 1, count: 2, total: 3 })
})



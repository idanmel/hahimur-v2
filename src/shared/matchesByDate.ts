import { matchSortKey } from './matchOrder'
import type { KnockoutMatch, KnockoutStages, Match, MatchScores, TournamentResults } from './types'
import { GROUPS, ALL_GROUP_LETTERS, type GroupLetter } from './groups'

export type MatchEntry = { match: Match; group: GroupLetter }
export type DateGroup  = { date: string; dayLabel: string; matches: MatchEntry[] }

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']

type Dated = { matchDate?: string; kickoffIST?: string }
export type DatedGroup<T> = { date: string; dayLabel: string; items: T[] }

// Chronological date buckets for any list of dated items — group fixtures and
// knockout fixtures alike. `dated` says where an item keeps its date/time.
// Month-aware: matchDate strings name their Hebrew month ('30 ביוני' / '1 ביולי'),
// so June and July sort and day-label correctly.
export function dateGroups<T>(items: T[], dated: (item: T) => Dated): DatedGroup<T>[] {
  const sorted = [...items].sort((a, b) => {
    const da = dated(a), db = dated(b)
    return matchSortKey(da.matchDate, da.kickoffIST) - matchSortKey(db.matchDate, db.kickoffIST)
  })
  const grouped: DatedGroup<T>[] = []
  for (const item of sorted) {
    const date = dated(item).matchDate ?? ''
    const last = grouped[grouped.length - 1]
    if (last?.date === date) {
      last.items.push(item)
    } else {
      const day = parseInt(date, 10)
      const month = date.includes('ביולי') ? 6 : 5
      const d = new Date(2026, month, day)
      grouped.push({ date, dayLabel: `יום ${HE_DAYS[d.getDay()]}`, items: [item] })
    }
  }
  return grouped
}

export function groupMatchesByDate(entries: MatchEntry[]): DateGroup[] {
  return dateGroups(entries, e => e.match)
    .map(({ date, dayLabel, items }) => ({ date, dayLabel, matches: items }))
}

// All group-stage matches in kickoff order, bucketed by date. Derived from
// static fixture data, so it's computed once at module load and shared.
export const GROUP_MATCHES_BY_DATE: DateGroup[] = groupMatchesByDate(
  ALL_GROUP_LETTERS.flatMap(l =>
    (GROUPS[l]?.matches ?? []).map(m => ({ match: m, group: l }))
  )
)

// Earliest chronological group match with no finished score, or undefined once
// they're all played. Both the results page and per-bettor form view use this
// to auto-scroll their by-date view to where the tournament currently is.
export function nextUnplayedMatchId(results: TournamentResults): string | undefined {
  const scores: Record<string, MatchScores> = {}
  for (const matches of Object.values(results.groupMatches)) {
    for (const m of matches) if (m.scores) scores[m.id] = m.scores
  }
  for (const { matches } of GROUP_MATCHES_BY_DATE) {
    for (const { match } of matches) {
      const s = scores[match.id]
      if (!s || s.home === null || s.away === null) return match.id
    }
  }
  return undefined
}

// The knockout twin of nextUnplayedMatchId: earliest chronological KO fixture
// with no finished score, or undefined once they're all played. The bracket's
// by-date view auto-scrolls here.
export function nextUnplayedKOMatchId(stages: KnockoutStages): string | undefined {
  const next = Object.values(stages).flat()
    .filter(m => !m.scores || m.scores.home === null || m.scores.away === null)
    .reduce<KnockoutMatch | null>((earliest, m) =>
      !earliest || matchSortKey(m.matchDate, m.kickoffIST) < matchSortKey(earliest.matchDate, earliest.kickoffIST)
        ? m : earliest, null)
  return next ? String(next.matchNum) : undefined
}

import type { Match, MatchScores, Standing } from '../types'

function emptyStanding(team: string): Standing {
  return { team, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 }
}

function byOverallGD(a: Standing, b: Standing): number {
  return (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst)
    || b.goalsFor - a.goalsFor
    || a.team.localeCompare(b.team)
}

interface H2HRecord { pts: number; gd: number; goals: number }

function computeH2HRecords(group: Standing[], h2hMatches: Match[], predictions: Record<string, MatchScores>): Map<string, H2HRecord> {
  const records = new Map<string, H2HRecord>(group.map(s => [s.team, { pts: 0, gd: 0, goals: 0 }]))
  for (const m of h2hMatches) {
    const pred = predictions[m.id]
    if (!pred || pred.home === null || pred.away === null) continue
    const home = records.get(m.homeTeam)!
    const away = records.get(m.awayTeam)!
    home.goals += pred.home; away.goals += pred.away
    home.gd += pred.home - pred.away; away.gd += pred.away - pred.home
    if (pred.home > pred.away)      { home.pts += 3 }
    else if (pred.away > pred.home) { away.pts += 3 }
    else                            { home.pts += 1; away.pts += 1 }
  }
  return records
}

function sortTiedGroup(group: Standing[], matches: Match[], predictions: Record<string, MatchScores>): void {
  if (group.length <= 1) return

  const teamSet = new Set(group.map(s => s.team))
  const h2h = computeH2HRecords(
    group,
    matches.filter(m => teamSet.has(m.homeTeam) && teamSet.has(m.awayTeam)),
    predictions
  )

  group.sort((a, b) => {
    const ha = h2h.get(a.team)!, hb = h2h.get(b.team)!
    return hb.pts - ha.pts || hb.gd - ha.gd || hb.goals - ha.goals
  })

  // Resolve each still-tied contiguous subset
  let i = 0
  while (i < group.length) {
    let j = i + 1
    while (j < group.length) {
      const prev = h2h.get(group[j - 1].team)!, curr = h2h.get(group[j].team)!
      if (prev.pts !== curr.pts || prev.gd !== curr.gd || prev.goals !== curr.goals) break
      j++
    }
    if (j - i > 1) {
      const subset = group.slice(i, j)
      if (subset.length < group.length) {
        sortTiedGroup(subset, matches, predictions)   // progress: re-apply h2h to subset
      } else {
        subset.sort(byOverallGD)                      // no progress: fall through to criteria d+
      }
      group.splice(i, j - i, ...subset)
    }
    i = j
  }
}

export function calculateStandings(matches: Match[], predictions: Record<string, MatchScores>): Standing[] {
  const byTeam = new Map<string, Standing>()
  for (const m of matches) {
    if (!byTeam.has(m.homeTeam)) byTeam.set(m.homeTeam, emptyStanding(m.homeTeam))
    if (!byTeam.has(m.awayTeam)) byTeam.set(m.awayTeam, emptyStanding(m.awayTeam))
  }

  for (const match of matches) {
    const pred = predictions[match.id]
    if (!pred || pred.home === null || pred.away === null) continue

    const home = byTeam.get(match.homeTeam)!
    const away = byTeam.get(match.awayTeam)!

    home.played++; away.played++
    home.goalsFor += pred.home;    away.goalsFor += pred.away
    home.goalsAgainst += pred.away; away.goalsAgainst += pred.home

    if (pred.home > pred.away) {
      home.won++; home.points += 3; away.lost++
    } else if (pred.away > pred.home) {
      away.won++; away.points += 3; home.lost++
    } else {
      home.drawn++; home.points++; away.drawn++; away.points++
    }
  }

  const teams = [...byTeam.values()]
  const byPoints = new Map<number, Standing[]>()
  for (const s of teams) {
    const group = byPoints.get(s.points) ?? []
    group.push(s)
    byPoints.set(s.points, group)
  }

  for (const group of byPoints.values()) {
    sortTiedGroup(group, matches, predictions)
  }

  return [...byPoints.entries()]
    .sort(([a], [b]) => b - a)
    .flatMap(([, group]) => group)
}

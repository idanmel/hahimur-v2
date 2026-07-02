// The single source of truth for golden-boot players users picked. The Hebrew
// name is the player's identity everywhere: users' topGoalscorer picks,
// realGoals keys in tournament-results.ts, live-overlay goal credits, and the
// race board all join on it. Everything that used to hand-copy these names
// (espnLive SCORER_ALIASES, fetch-scores SCORER_ALIASES, goldenBootNames
// TEAM_BY_PLAYER's picked rows, update-scorers TRACKED_PLAYERS) now derives
// from here; scorers.test.ts checks the picks and entered goals against it.
//
// sourceNames lists every spelling a data source uses for the player (ESPN
// athlete displayName, football-data scorer name). A player can have several —
// keep old spellings around, an extra alias is harmless but a missing one
// silently drops goals.
export interface ScorerInfo {
  team: string // internal team name, as in shared/groups.ts
  sourceNames: readonly string[]
}

export const PICKED_SCORERS = {
  'קיליאן אמבפה': { team: 'France', sourceNames: ['Kylian Mbappé'] },
  'הארי קיין': { team: 'England', sourceNames: ['Harry Kane'] },
  'קאי האברץ': { team: 'Germany', sourceNames: ['Kai Havertz'] },
  'פלוריאן וירץ': { team: 'Germany', sourceNames: ['Florian Wirtz'] },
  'פראן טורס': { team: 'Spain', sourceNames: ['Ferran Torres'] },
  'לאמין ימאל': { team: 'Spain', sourceNames: ['Lamine Yamal', 'Lamin Yamal'] },
  'ויניסיוס ג׳וניור': { team: 'Brazil', sourceNames: ['Vinícius Júnior'] },
} as const satisfies Record<string, ScorerInfo>

export type PickedScorer = keyof typeof PICKED_SCORERS

const entries = Object.entries(PICKED_SCORERS) as [PickedScorer, ScorerInfo][]

// Source scorer name (any spelling) -> canonical Hebrew name.
export const SCORER_ALIASES: Record<string, PickedScorer> = Object.fromEntries(
  entries.flatMap(([he, { sourceNames }]) => sourceNames.map(src => [src, he]))
)

// Canonical Hebrew name -> the player's national team.
export const TEAM_BY_PICKED: Record<PickedScorer, string> = Object.fromEntries(
  entries.map(([he, { team }]) => [he, team])
) as Record<PickedScorer, string>

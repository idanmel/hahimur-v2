import * as d3 from 'd3'

// A stable, distinct color per bettor. Several categorical schemes concatenated
// give ~30 well-separated hues; assigning by the bettor's index in a fixed roster
// order means a person keeps the same color across every frame of the race.
const PALETTE: string[] = [
  ...d3.schemeTableau10,
  ...d3.schemeSet2,
  ...d3.schemeDark2,
  ...d3.schemeSet3,
]

export function bettorColors(labels: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  labels.forEach((label, i) => { map[label] = PALETTE[i % PALETTE.length] })
  return map
}

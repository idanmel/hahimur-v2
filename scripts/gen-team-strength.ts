// Regenerates src/pages/results/teamStrength.ts from a World Football Elo
// Ratings snapshot (eloratings.net). Elo already bakes in in-tournament results,
// so refreshing it is the single lever that keeps the Monte-Carlo win-prob model
// in step with how teams are actually performing.
//
// Mapping (REF Elo 1780 = average WC team → 1.0/1.0):
//   att = clamp((Elo/1780)^3.2, 0.50, 1.85)
//   def = clamp((1780/Elo)^2.4, 0.62, 1.35)
//
// To refresh: paste the latest "Current Ratings" from
// https://www.eloratings.net/2026_World_Cup into RATINGS below (key must match
// the team name the app uses — see src/shared/groups.ts), update SNAPSHOT, then:
//   npx tsx scripts/gen-team-strength.ts
//
// Run with: npx tsx scripts/gen-team-strength.ts
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const SNAPSHOT = '28 June 2026'
const REF = 1780

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const round2 = (x: number) => Math.round(x * 100) / 100
const att = (elo: number) => round2(clamp((elo / REF) ** 3.2, 0.5, 1.85))
const def = (elo: number) => round2(clamp((REF / elo) ** 2.4, 0.62, 1.35))

// Current Ratings as of the SNAPSHOT date, highest first. App team name → Elo.
// Note: keys use the app's spelling (e.g. 'Czech Republic', not 'Czechia').
const RATINGS: [string, number][] = [
  ['Spain', 2144],
  ['Argentina', 2144],
  ['France', 2123],
  ['England', 2038],
  ['Brazil', 2009],
  ['Colombia', 2004],
  ['Portugal', 1990],
  ['Netherlands', 1980],
  ['Norway', 1918],
  ['Germany', 1916],
  ['Switzerland', 1914],
  ['Mexico', 1912],
  ['Japan', 1910],
  ['Croatia', 1905],
  ['Ecuador', 1902],
  ['Belgium', 1884],
  ['Morocco', 1877],
  ['Turkey', 1852],
  ['Senegal', 1842],
  ['Uruguay', 1841],
  ['Austria', 1841],
  ['Paraguay', 1815],
  ['Australia', 1800],
  ['United States', 1781],
  ['Algeria', 1780],
  ['Iran', 1764],
  ['Canada', 1748],
  ['Scotland', 1745],
  ['Ivory Coast', 1743],
  ['Sweden', 1742],
  ['Egypt', 1742],
  ['South Korea', 1723],
  ['DR Congo', 1712],
  ['Czech Republic', 1680],
  ['Panama', 1658],
  ['Jordan', 1632],
  ['Uzbekistan', 1631],
  ['Bosnia and Herzegovina', 1622],
  ['Cape Verde', 1622],
  ['Saudi Arabia', 1596],
  ['Ghana', 1575],
  ['South Africa', 1575],
  ['Tunisia', 1562],
  ['Iraq', 1561],
  ['New Zealand', 1534],
  ['Haiti', 1517],
  ['Curaçao', 1438],
  ['Qatar', 1411],
]

const pad = (s: string) => `'${s}':`.padEnd(26)

const lines = RATINGS.map(([name, elo], i) => {
  const a = att(elo).toFixed(2)
  const d = def(elo).toFixed(2)
  return `  ${pad(name)} { att: ${a}, def: ${d} }, // Elo ${elo} (#${i + 1})`
})

const out = `// Attack = goals scored relative to average (1.0). Defense = goals conceded relative to average (lower = harder to score against).
// λ_home_goals = 1.3 × home.att × away.def
//
// Source: derived from the World Football Elo Ratings (eloratings.net) snapshot of
// ${SNAPSHOT} — the most predictive public rating for match outcomes, and it already
// folds in results so far. Teams are ordered and scaled by their Elo so the ladder
// is objective rather than hand-set.
// Mapping (REF Elo ${REF} = average WC team → 1.0/1.0):
//   att = clamp((Elo/${REF})^3.2, 0.50, 1.85)
//   def = clamp((${REF}/Elo)^2.4, 0.62, 1.35)
// Regenerate from a newer snapshot with: npx tsx scripts/gen-team-strength.ts
export const TEAM_STRENGTH: Record<string, { att: number; def: number }> = {
${lines.join('\n')}
}
`

const here = dirname(fileURLToPath(import.meta.url))
const target = resolve(here, '../src/pages/results/teamStrength.ts')
writeFileSync(target, out)
console.log(`Wrote ${RATINGS.length} teams to ${target}`)

import { useMemo } from 'react'
import BarChartRace from './BarChartRace'
import { buildRaceFrames } from './raceFrames'
import { bettorColors } from './bettorColors'
import type { TournamentResults } from '../shared/types'
import type { User } from '../users'

// The /rivalry pair. If you are one of them, the other is highlighted as your rival.
const RIVALS = ['אלדד לוי', 'אלרד גומא']

export default function TimelapseView({ users, results, me }: { users: User[]; results: TournamentResults; me?: string }) {
  // ~20ms to build; the parent only re-renders on a live poll (every 30s), never
  // during playback (the chart owns its own clock), so a plain memo is enough.
  const frames = useMemo(() => buildRaceFrames(users, results), [users, results])
  const colors = useMemo(() => bettorColors(users.map(u => u.label)), [users])
  const rival = me && RIVALS.includes(me) ? RIVALS.find(r => r !== me) : undefined

  return (
    <section className="bcr-section" dir="rtl">
      <BarChartRace frames={frames} colors={colors} me={me} rival={rival} />
    </section>
  )
}

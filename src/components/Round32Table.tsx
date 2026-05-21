import type { R32Match } from '../types'
import { TEAMS } from '../lib/groups'

interface Props {
  matches: R32Match[]
}

function TeamSlot({ name }: { name: string }) {
  const info = TEAMS[name]
  return (
    <div className={`r32-slot ${info ? 'r32-slot--resolved' : 'r32-slot--pending'}`}>
      {info ? (
        <span className={`fi fi-${info.iso} r32-slot-flag`} />
      ) : (
        <span className="r32-slot-flag-ph" />
      )}
      <span className="r32-slot-name">{info ? info.he : name}</span>
    </div>
  )
}

export default function Round32Table({ matches }: Props) {
  return (
    <div className="r32-grid">
      {matches.map(m => (
        <div key={m.matchNum} className={`r32-card${m.resolved ? ' r32-card--resolved' : ''}`}>
          <span className="r32-matchnum">{m.matchNum}</span>
          <TeamSlot name={m.home} />
          <div className="r32-divider">
            <span className="r32-divider-line" />
            <span className="r32-divider-word">נגד</span>
            <span className="r32-divider-line" />
          </div>
          <TeamSlot name={m.away} />
        </div>
      ))}
    </div>
  )
}

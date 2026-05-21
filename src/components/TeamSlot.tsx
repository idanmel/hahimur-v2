import { TEAMS } from '../lib/groups'

export default function TeamSlot({ name }: { name: string }) {
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

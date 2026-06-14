import { useState } from 'react'
import { USERS_SORTED } from '../users'
import { useCurrentUser } from './useCurrentUser'
import './UserPicker.css'

/**
 * A quiet greeting line under the nav.
 *
 *  - Unknown / switching: the inline picker, asking who you are.
 *  - Known: "שלום, <name>" — no picker. The name itself is the switch:
 *    tap it to re-open the picker. No reason to keep asking a question
 *    you've already answered.
 *
 * Self-contained: reads and writes the shared current-user store.
 */
export default function UserPicker() {
  const { me, pickMe } = useCurrentUser()
  const identified = me !== ''
  const [editing, setEditing] = useState(false)
  const picking = !identified || editing

  const handlePick = (label: string) => {
    pickMe(label)
    setEditing(false)
  }

  return (
    <div dir="rtl" className={`greeting${identified ? ' greeting--known' : ''}`}>
      {picking ? (
        <span className="greeting__field" key={me /* re-stamp on change */}>
          <select
            className="greeting__select"
            aria-label="המהמר"
            autoFocus={editing}
            value={me}
            onChange={e => handlePick(e.target.value)}
            onBlur={() => identified && setEditing(false)}
          >
            <option value="">מי אתה?</option>
            {USERS_SORTED.map(u => (
              <option key={u.label} value={u.label}>{u.label}</option>
            ))}
          </select>
          <span className="greeting__chevron" aria-hidden="true">▾</span>
        </span>
      ) : (
        <span className="greeting__hello">
          שלום,{' '}
          <button
            type="button"
            className="greeting__name"
            onClick={() => setEditing(true)}
            aria-label={`מחובר בתור ${me} — החלף משתמש`}
          >
            {me}
          </button>
        </span>
      )}
    </div>
  )
}

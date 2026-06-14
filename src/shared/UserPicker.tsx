import { USERS_SORTED } from '../users'
import { useCurrentUser } from './useCurrentUser'
import './UserPicker.css'

/**
 * Global "tournament credential" — the viewer stamps who they are once and it
 * follows them across every page. Self-contained: reads and writes the shared
 * current-user store, so it can be dropped into the nav with no wiring.
 */
export default function UserPicker() {
  const { me, pickMe } = useCurrentUser()
  const identified = me !== ''

  return (
    <div dir="rtl" className={`credential${identified ? ' credential--stamped' : ''}`}>
      <span className="credential__eyebrow" aria-hidden="true">
        {identified ? 'המהמר' : 'מי אתה?'}
      </span>
      <div className="credential__field" key={me /* re-stamp on change */}>
        <select
          className="credential__select"
          aria-label="המהמר"
          value={me}
          onChange={e => pickMe(e.target.value)}
        >
          <option value="">בחר את השם שלך</option>
          {USERS_SORTED.map(u => (
            <option key={u.label} value={u.label}>{u.label}</option>
          ))}
        </select>
        <span className="credential__chevron" aria-hidden="true">▾</span>
      </div>
    </div>
  )
}

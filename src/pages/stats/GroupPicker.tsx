import { ALL_GROUP_LETTERS, GROUP_HEBREW } from '../../shared/groups'
import type { GroupLetter } from '../../shared/groups'
import './GroupPicker.css'

interface Props {
  activeGroup?: GroupLetter
}

export default function GroupPicker({ activeGroup }: Props) {
  return (
    <nav className="stats-group-picker" aria-label="סטטיסטיקות לפי בית">
      {ALL_GROUP_LETTERS.map(letter =>
        letter === activeGroup ? (
          <span
            key={letter}
            className="stats-group-chip stats-group-chip--active"
            aria-current="page"
          >
            בית {GROUP_HEBREW[letter]}
          </span>
        ) : (
          <a
            key={letter}
            href={`/stats/groups/${letter.toLowerCase()}`}
            className="stats-group-chip"
          >
            בית {GROUP_HEBREW[letter]}
          </a>
        ),
      )}
    </nav>
  )
}

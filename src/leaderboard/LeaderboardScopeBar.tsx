import { GROUPS, ALL_GROUP_LETTERS } from '../shared/groups'
import type { Scope } from './leaderboardRows'

export default function LeaderboardScopeBar({ scope, onScopeChange, lastX, onLastXChange }: {
  scope: Scope
  onScopeChange: (s: Scope) => void
  lastX: number
  onLastXChange: (n: number) => void
}) {
  return (
    <div className="lb-scope-bar">
      <button
        type="button"
        className={`lb-scope-btn lb-scope-btn--reset${scope === 'all' ? ' lb-scope-btn--active' : ''}`}
        onClick={() => onScopeChange('all')}
      >הכל</button>
      {ALL_GROUP_LETTERS.map(letter => (
        <button
          key={letter}
          type="button"
          className={`lb-scope-btn${scope === letter ? ' lb-scope-btn--active' : ''}`}
          onClick={() => onScopeChange(letter)}
        >{GROUPS[letter].he}</button>
      ))}
      <button
        type="button"
        className={`lb-scope-btn${scope === 'lastX' ? ' lb-scope-btn--active' : ''}`}
        onClick={() => onScopeChange('lastX')}
      >משחקים אחרונים</button>
      {scope === 'lastX' && (
        <label className="lb-lastx-picker">
          <input
            type="number"
            className="lb-lastx-input"
            min={1}
            value={lastX}
            onChange={e => onLastXChange(Math.max(1, Number(e.target.value) || 1))}
            aria-label="מספר משחקים אחרונים"
          />
          משחקים
        </label>
      )}
    </div>
  )
}

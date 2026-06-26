import { useState } from 'react'
import { GROUPS, ALL_GROUP_LETTERS } from '../shared/groups'
import type { GroupLetter } from '../shared/groups'
import type { Scope } from './leaderboardRows'

const NON_GROUP_SCOPES = ['all', 'range', 'prob', 'summary', 'oleh', 'crossings', 'timelapse'] as const
const isGroupScope = (s: Scope): s is GroupLetter => !(NON_GROUP_SCOPES as readonly string[]).includes(s)
// "summary" (all groups together) lives inside the לפי בית tab next to the groups
const isGroupMode = (s: Scope): boolean => isGroupScope(s) || s === 'summary'

export default function LeaderboardScopeBar({ scope, onScopeChange, rangeFrom, rangeTo, onRangeFromChange, onRangeToChange, playedMatchLabels }: {
  scope: Scope
  onScopeChange: (s: Scope) => void
  rangeFrom: number
  rangeTo: number
  onRangeFromChange: (n: number) => void
  onRangeToChange: (n: number) => void
  playedMatchLabels: string[]
}) {
  // remembered so re-entering "לפי בית" lands on the group you were viewing
  const [lastGroup, setLastGroup] = useState<GroupLetter>(isGroupScope(scope) ? scope : 'A')
  // for non-group scopes the mode is just the scope name itself
  const mode = isGroupMode(scope) ? 'group' : scope
  const playedCount = playedMatchLabels.length

  const modeBtn = (active: boolean) =>
    `lb-scope-mode${active ? ' lb-scope-mode--active' : ''}`

  return (
    <div className="lb-scope-bar">
      <div className="lb-scope-modes">
        <button
          type="button"
          className={modeBtn(mode === 'all')}
          aria-pressed={mode === 'all'}
          onClick={() => onScopeChange('all')}
        >הכל</button>
        <button
          type="button"
          className={modeBtn(mode === 'group')}
          aria-pressed={mode === 'group'}
          onClick={() => onScopeChange(lastGroup)}
        >לפי בית</button>
        <button
          type="button"
          className={modeBtn(mode === 'range')}
          aria-pressed={mode === 'range'}
          onClick={() => onScopeChange('range')}
        >טווח</button>
        <button
          type="button"
          className={modeBtn(mode === 'oleh')}
          aria-pressed={mode === 'oleh'}
          onClick={() => onScopeChange('oleh')}
        >עולות ומיקומים</button>
        <button
          type="button"
          className={modeBtn(mode === 'crossings')}
          aria-pressed={mode === 'crossings'}
          onClick={() => onScopeChange('crossings')}
        >הצלבות</button>
        <button
          type="button"
          className={modeBtn(mode === 'timelapse')}
          aria-pressed={mode === 'timelapse'}
          onClick={() => onScopeChange('timelapse')}
        >טיימלאפס</button>
      </div>

      {mode === 'group' && (
        <div className="lb-scope-row">
          {ALL_GROUP_LETTERS.map(letter => (
            <button
              key={letter}
              type="button"
              className={`lb-scope-group${scope === letter ? ' lb-scope-group--active' : ''}`}
              aria-pressed={scope === letter}
              onClick={() => { setLastGroup(letter); onScopeChange(letter) }}
            >{GROUPS[letter].he}</button>
          ))}
          <button
            type="button"
            className={`lb-scope-group lb-scope-summary${scope === 'summary' ? ' lb-scope-group--active' : ''}`}
            aria-pressed={scope === 'summary'}
            onClick={() => onScopeChange('summary')}
          >סיכום</button>
        </div>
      )}

      {mode === 'range' && (
        <div className="lb-scope-row lb-range-row">
          {playedCount === 0 ? (
            <span className="lb-lastx-caption">אין עדיין משחקים ששוחקו</span>
          ) : (
            <div className="lb-range-picker">
              {[
                { label: 'מ־', value: rangeFrom, onChange: onRangeFromChange },
                { label: 'עד', value: rangeTo, onChange: onRangeToChange },
              ].map(field => (
                <label key={field.label} className="lb-range-field">
                  <span className="lb-range-label">{field.label}</span>
                  <span className="lb-range-select-wrap">
                    <select
                      className="lb-range-select"
                      value={field.value}
                      onChange={e => field.onChange(Number(e.target.value))}
                    >
                      {playedMatchLabels.map((label, i) => (
                        <option key={i} value={i + 1}>{i + 1}. {label}</option>
                      ))}
                    </select>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { GROUPS, ALL_GROUP_LETTERS } from '../shared/groups'
import type { GroupLetter } from '../shared/groups'
import type { Scope } from './leaderboardRows'

const NON_GROUP_SCOPES = ['all', 'lastX', 'asOf', 'range'] as const
const isGroupScope = (s: Scope): s is GroupLetter => !(NON_GROUP_SCOPES as readonly string[]).includes(s)

export default function LeaderboardScopeBar({ scope, onScopeChange, lastX, onLastXChange, asOfIndex, onAsOfChange, rangeFrom, rangeTo, onRangeFromChange, onRangeToChange, playedMatchLabels }: {
  scope: Scope
  onScopeChange: (s: Scope) => void
  lastX: number
  onLastXChange: (n: number) => void
  asOfIndex: number
  onAsOfChange: (n: number) => void
  rangeFrom: number
  rangeTo: number
  onRangeFromChange: (n: number) => void
  onRangeToChange: (n: number) => void
  playedMatchLabels: string[]
}) {
  // remembered so re-entering "לפי בית" lands on the group you were viewing
  const [lastGroup, setLastGroup] = useState<GroupLetter>(isGroupScope(scope) ? scope : 'A')
  // for non-group scopes the mode is just the scope name itself
  const mode = isGroupScope(scope) ? 'group' : scope
  const playedCount = playedMatchLabels.length
  const currentMatchLabel = playedMatchLabels[asOfIndex - 1]

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
          className={modeBtn(mode === 'lastX')}
          aria-pressed={mode === 'lastX'}
          onClick={() => onScopeChange('lastX')}
        >משחקים אחרונים</button>
        <button
          type="button"
          className={modeBtn(mode === 'asOf')}
          aria-pressed={mode === 'asOf'}
          onClick={() => onScopeChange('asOf')}
        >לפי משחק</button>
        <button
          type="button"
          className={modeBtn(mode === 'range')}
          aria-pressed={mode === 'range'}
          onClick={() => onScopeChange('range')}
        >טווח</button>
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
        </div>
      )}

      {mode === 'lastX' && (
        <div className="lb-scope-row">
          <div className="lb-lastx-stepper" role="group" aria-label="מספר משחקים אחרונים">
            <button
              type="button"
              className="lb-lastx-step"
              onClick={() => onLastXChange(lastX + 1)}
              aria-label="עוד משחק"
            >+</button>
            <input
              type="number"
              className="lb-lastx-input"
              min={1}
              value={lastX}
              onChange={e => onLastXChange(Math.max(1, Number(e.target.value) || 1))}
              aria-label="מספר משחקים אחרונים"
            />
            <button
              type="button"
              className="lb-lastx-step"
              onClick={() => onLastXChange(Math.max(1, lastX - 1))}
              disabled={lastX <= 1}
              aria-label="פחות משחק"
            >−</button>
          </div>
          <span className="lb-lastx-caption">משחקים אחרונים ששוחקו</span>
        </div>
      )}

      {mode === 'asOf' && (
        <div className="lb-scope-row">
          {playedCount === 0 ? (
            <span className="lb-lastx-caption">אין עדיין משחקים ששוחקו</span>
          ) : (
            <>
              <input
                type="range"
                className="lb-asof-slider"
                min={1}
                max={playedCount}
                value={asOfIndex}
                onChange={e => onAsOfChange(Number(e.target.value))}
                aria-label="מצב הטבלה אחרי משחק"
              />
              <span className="lb-lastx-caption">
                אחרי משחק {asOfIndex}/{playedCount} · {currentMatchLabel}
              </span>
            </>
          )}
        </div>
      )}

      {mode === 'range' && (
        <div className="lb-scope-row lb-range-row">
          {playedCount === 0 ? (
            <span className="lb-lastx-caption">אין עדיין משחקים ששוחקו</span>
          ) : (
            [
              { label: 'מ־', value: rangeFrom, onChange: onRangeFromChange },
              { label: 'עד', value: rangeTo, onChange: onRangeToChange },
            ].map(field => (
              <label key={field.label} className="lb-range-field">
                <span className="lb-range-label">{field.label}</span>
                <select
                  className="lb-range-select"
                  value={field.value}
                  onChange={e => field.onChange(Number(e.target.value))}
                >
                  {playedMatchLabels.map((label, i) => (
                    <option key={i} value={i + 1}>{i + 1}. {label}</option>
                  ))}
                </select>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  )
}

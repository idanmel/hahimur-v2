import { useState, useEffect } from 'react'
import { clampGoals } from './ResultsPage'

interface Props {
  players: string[]
  realGoals: Record<string, number>
  defaultWinner: string[]
  pickersByPlayer?: Record<string, string[]>
  onChange: (goals: Record<string, number>, winners: string[]) => void
}

function PlayerGoalInput({ player, min, value, onCommit }: {
  player: string
  min: number
  value: number
  onCommit: (value: number) => void
}) {
  const [display, setDisplay] = useState(String(value))

  useEffect(() => {
    setDisplay(String(value))
  }, [value])

  return (
    <input
      type="number"
      inputMode="numeric"
      aria-label={player}
      min={min}
      className="pg-scorer-input"
      value={display}
      onChange={e => setDisplay(e.target.value)}
      onFocus={e => e.target.select()}
      onBlur={() => {
        const clamped = clampGoals(min, Number(display) || 0)
        setDisplay(String(clamped))
        onCommit(clamped)
      }}
    />
  )
}

export default function GoalScorerSection({ players, realGoals, defaultWinner, pickersByPlayer, onChange }: Props) {
  const [playerGoals, setPlayerGoals] = useState<Record<string, number>>(realGoals)
  const [goldenBootWinners, setGoldenBootWinners] = useState<string[]>(defaultWinner)

  const maxGoals = Math.max(0, ...players.map(p => playerGoals[p] ?? 0))

  useEffect(() => {
    setGoldenBootWinners(prev => {
      if (prev.length === 0) return prev
      const stillTied = prev.filter(p => maxGoals > 0 && (playerGoals[p] ?? 0) >= maxGoals)
      if (stillTied.length === 0) return []
      return players.filter(p => (playerGoals[p] ?? 0) === maxGoals)
    })
  }, [playerGoals])

  useEffect(() => {
    onChange(playerGoals, goldenBootWinners)
  }, [playerGoals, goldenBootWinners])

  return (
    <div className="pg-scorer-list">
      {players.map(player => (
        <div key={player} className={`pg-scorer-row${goldenBootWinners.includes(player) ? ' pg-scorer-row--winner' : ''}`}>
          <input
            type="checkbox"
            aria-label={player}
            className="pg-scorer-checkbox"
            checked={goldenBootWinners.includes(player)}
            disabled={maxGoals === 0 || (playerGoals[player] ?? 0) < maxGoals}
            onChange={() => setGoldenBootWinners(prev =>
              prev.length > 0
                ? []
                : players.filter(p => (playerGoals[p] ?? 0) === maxGoals)
            )}
          />
          <div className="pg-scorer-player">
            <span className="pg-scorer-name">{player}</span>
            {pickersByPlayer?.[player]?.length ? (
              <div className="pg-scorer-pickers">
                {pickersByPlayer[player].map(label => (
                  <span key={label} className="pg-scorer-picker">{label}</span>
                ))}
              </div>
            ) : null}
          </div>
          <PlayerGoalInput
            player={player}
            min={realGoals[player] ?? 0}
            value={playerGoals[player] ?? 0}
            onCommit={val => setPlayerGoals(prev => ({ ...prev, [player]: val }))}
          />
        </div>
      ))}
    </div>
  )
}

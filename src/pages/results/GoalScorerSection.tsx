import { useState } from 'react'
import { clampGoals } from './resultsUtils'

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

  const commitGoals = (player: string, val: number) => {
    const nextGoals = { ...playerGoals, [player]: val }
    const nextMax = Math.max(0, ...players.map(p => nextGoals[p] ?? 0))
    let nextWinners = goldenBootWinners
    if (nextWinners.length > 0) {
      const stillTied = nextWinners.filter(p => nextMax > 0 && (nextGoals[p] ?? 0) >= nextMax)
      nextWinners = stillTied.length === 0
        ? []
        : players.filter(p => (nextGoals[p] ?? 0) === nextMax)
    }
    setPlayerGoals(nextGoals)
    setGoldenBootWinners(nextWinners)
    onChange(nextGoals, nextWinners)
  }

  const toggleWinners = () => {
    const nextWinners = goldenBootWinners.length > 0
      ? []
      : players.filter(p => (playerGoals[p] ?? 0) === maxGoals)
    setGoldenBootWinners(nextWinners)
    onChange(playerGoals, nextWinners)
  }

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
            onChange={toggleWinners}
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
            key={playerGoals[player] ?? 0}
            player={player}
            min={realGoals[player] ?? 0}
            value={playerGoals[player] ?? 0}
            onCommit={val => commitGoals(player, val)}
          />
        </div>
      ))}
    </div>
  )
}

import { useMemo, useState } from 'react'
import { clampGoals } from './resultsUtils'

interface Props {
  players: string[]
  realGoals: Record<string, number>
  defaultWinner: string[]
  pickersByPlayer?: Record<string, string[]>
  // Players whose national team is already out of the tournament. Combined with
  // the live lead below, a trailing one is flagged "out of the race" — they can't
  // add goals, so they can never (co-)win the Golden Boot.
  eliminatedPlayers?: string[]
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

export default function GoalScorerSection({ players, realGoals, defaultWinner, pickersByPlayer, eliminatedPlayers, onChange }: Props) {
  const [playerGoals, setPlayerGoals] = useState<Record<string, number>>(realGoals)
  const [goldenBootWinners, setGoldenBootWinners] = useState<string[]>(defaultWinner)

  const maxGoals = Math.max(0, ...players.map(p => playerGoals[p] ?? 0))
  const eliminated = useMemo(() => new Set(eliminatedPlayers ?? []), [eliminatedPlayers])

  // Row order is fixed at mount by the real/live totals (realGoals), NOT by the
  // live-edited playerGoals — otherwise a row would jump as you type into it.
  // JS sort is stable, so equal totals keep the incoming order (picked first).
  const orderedPlayers = useMemo(
    () => [...players].sort((a, b) => (realGoals[b] ?? 0) - (realGoals[a] ?? 0)),
    [players, realGoals],
  )

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
      {orderedPlayers.map(player => {
        const isLeader = maxGoals > 0 && (playerGoals[player] ?? 0) === maxGoals
        const isWinner = goldenBootWinners.includes(player)
        // Out of the race: team already eliminated AND already behind the lead,
        // so their goal count is frozen below a total they can never reach.
        const isOut = eliminated.has(player) && maxGoals > 0 && (playerGoals[player] ?? 0) < maxGoals
        return (
        <div key={player} className={`pg-scorer-row${isWinner ? ' pg-scorer-row--winner' : ''}${isLeader ? ' pg-scorer-row--leader' : ''}${isOut ? ' pg-scorer-row--out' : ''}`}>
          <input
            type="checkbox"
            aria-label={player}
            className="pg-scorer-checkbox"
            checked={isWinner}
            disabled={maxGoals === 0 || (playerGoals[player] ?? 0) < maxGoals}
            onChange={toggleWinners}
          />
          <div className="pg-scorer-player">
            <span className="pg-scorer-name">
              {player}
              {isLeader ? <span className="pg-scorer-leader-badge"><span className="pg-scorer-leader-star" aria-hidden="true">★</span>מוביל</span> : null}
              {isOut ? <span className="pg-scorer-out-badge">מחוץ למירוץ</span> : null}
            </span>
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
        )
      })}
    </div>
  )
}

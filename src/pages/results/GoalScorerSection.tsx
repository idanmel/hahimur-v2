import { useMemo, useState, type CSSProperties } from 'react'
import { clampGoals } from './resultsUtils'
import { TEAMS } from '../../shared/groups'
import { TEAM_BY_PLAYER } from './goldenBootNames'

interface Props {
  players: string[]
  realGoals: Record<string, number>
  defaultWinner: string[]
  pickersByPlayer?: Record<string, string[]>
  // Players whose national team is already out of the tournament. Combined with
  // the live lead below, a trailing one is flagged "out of the race" — they can't
  // add goals, so they can never (co-)win the Golden Boot.
  eliminatedPlayers?: string[]
  // The race is decided (the real winner is baked into tournament-results).
  // Renders static totals and a winner medal instead of editable controls.
  locked?: boolean
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

export default function GoalScorerSection({ players, realGoals, defaultWinner, pickersByPlayer, eliminatedPlayers, locked = false, onChange }: Props) {
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

  // Competition ranking ("1224") over the fixed mount order, so tied totals
  // share a numeral and the rank never jumps while typing.
  const ranks = useMemo(() => {
    const map: Record<string, number> = {}
    let rank = 0
    let prev = -1
    orderedPlayers.forEach((p, i) => {
      const goals = realGoals[p] ?? 0
      if (goals !== prev) { rank = i + 1; prev = goals }
      map[p] = rank
    })
    return map
  }, [orderedPlayers, realGoals])

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
    <div className="pg-scorer-board">
      <div className="pg-scorer-board-header">
        <span className="pg-scorer-board-title">המירוץ לנעל הזהב</span>
        <span className="pg-scorer-board-captions" aria-hidden="true">
          <span className="pg-scorer-board-caption pg-scorer-board-caption--goals">שערים</span>
          <span className="pg-scorer-board-caption pg-scorer-board-caption--winner">זוכה</span>
        </span>
      </div>
      <div className="pg-scorer-list">
        {orderedPlayers.map((player, i) => {
          const isLeader = maxGoals > 0 && (playerGoals[player] ?? 0) === maxGoals
          const isWinner = goldenBootWinners.includes(player)
          // Out of the race: team already eliminated AND already behind the lead,
          // so their goal count is frozen below a total they can never reach.
          // (Suppressed once the race is decided — "out of the race" is noise
          // when the race is over for everyone.)
          const isOut = !locked && eliminated.has(player) && maxGoals > 0 && (playerGoals[player] ?? 0) < maxGoals
          const iso = TEAMS[TEAM_BY_PLAYER[player] ?? '']?.iso
          const barPct = maxGoals > 0 ? ((playerGoals[player] ?? 0) / maxGoals) * 100 : 0
          return (
          <div
            key={player}
            className={`pg-scorer-row${isWinner ? ' pg-scorer-row--winner' : ''}${isLeader ? ' pg-scorer-row--leader' : ''}${isOut ? ' pg-scorer-row--out' : ''}`}
            style={{ '--pg-scorer-i': i } as CSSProperties}
          >
            <span className="pg-scorer-bar" style={{ width: `${barPct}%` }} aria-hidden="true" />
            <span className="pg-scorer-rank" aria-hidden="true">{ranks[player]}</span>
            {iso
              ? <span className={`fi fi-${iso} pg-scorer-flag`} aria-hidden="true" />
              : <span className="pg-scorer-flag pg-scorer-flag--blank" aria-hidden="true" />}
            <div className="pg-scorer-player">
              <span className="pg-scorer-name">
                {player}
                {isLeader && !locked ? <span className="pg-scorer-leader-badge"><span className="pg-scorer-leader-star" aria-hidden="true">★</span>מוביל</span> : null}
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
            {locked ? (
              <span className="pg-scorer-goals-static" data-testid={`goals-${player}`}>{playerGoals[player] ?? 0}</span>
            ) : (
              <PlayerGoalInput
                key={playerGoals[player] ?? 0}
                player={player}
                min={realGoals[player] ?? 0}
                value={playerGoals[player] ?? 0}
                onCommit={val => commitGoals(player, val)}
              />
            )}
            {locked ? (
              <span
                className={`pg-scorer-medal${isWinner ? ' pg-scorer-medal--won' : ''}`}
                data-testid={isWinner ? 'winner-medal' : undefined}
                aria-label={isWinner ? `${player} — זוכה בנעל הזהב` : undefined}
                aria-hidden={isWinner ? undefined : true}
              >★</span>
            ) : (
              <input
                type="checkbox"
                aria-label={player}
                className="pg-scorer-checkbox"
                checked={isWinner}
                disabled={maxGoals === 0 || (playerGoals[player] ?? 0) < maxGoals}
                onChange={toggleWinners}
              />
            )}
          </div>
          )
        })}
      </div>
    </div>
  )
}

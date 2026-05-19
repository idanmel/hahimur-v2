interface Props {
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
  onChange: (home: number | null, away: number | null) => void
}

function ScoreInput({
  team,
  value,
  onChange,
}: {
  team: string
  value: number | null
  onChange: (v: number | null) => void
}) {
  return (
    <label>
      {team} score
      <input
        type="number"
        aria-label={`${team} score`}
        min="0"
        step="1"
        value={value !== null ? value : ''}
        onChange={(e) => {
          const raw = e.target.value
          onChange(/^\d+$/.test(raw) ? Number(raw) : null)
        }}
      />
    </label>
  )
}

export default function MatchRow({ homeTeam, awayTeam, homeScore, awayScore, onChange }: Props) {
  return (
    <div>
      <ScoreInput team={homeTeam} value={homeScore} onChange={(v) => onChange(v, awayScore)} />
      <span>vs</span>
      <ScoreInput team={awayTeam} value={awayScore} onChange={(v) => onChange(homeScore, v)} />
    </div>
  )
}

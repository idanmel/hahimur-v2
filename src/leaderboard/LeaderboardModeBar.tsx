export type Mode = 'points' | 'hits'

const MODES: Array<{ key: Mode; label: string }> = [
  { key: 'points', label: 'נקודות' },
  { key: 'hits', label: 'ניחושים' },
]

export default function LeaderboardModeBar({ mode, onModeChange }: {
  mode: Mode
  onModeChange: (m: Mode) => void
}) {
  return (
    <div className="lb-mode-bar">
      {MODES.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          className={`lb-scope-btn${mode === key ? ' lb-scope-btn--active' : ''}`}
          onClick={() => onModeChange(key)}
        >{label}</button>
      ))}
    </div>
  )
}

import { TEAMS } from '../../shared/groups'

interface Props {
  winner: string
}

export default function ChampionBanner({ winner }: Props) {
  const info = TEAMS[winner]
  if (!info) return null

  return (
    <div className="champion-banner" dir="rtl">
      <div className="champion-banner__border champion-banner__border--top" />
      <div className="champion-banner__body">
        <span className="champion-banner__trophy">🏆</span>
        <span className={`fi fi-${info.iso} fis champion-banner__flag`} />
        <p className="champion-banner__label">אלופת העולם 2026</p>
        <p className="champion-banner__name">{info.he}</p>
      </div>
      <div className="champion-banner__border champion-banner__border--bottom" />
    </div>
  )
}

import type { TournamentResults } from '../../shared/types'
import { TEAMS } from '../../shared/groups'
import './TournamentWrapCard.css'

type Props = { results: TournamentResults }

// The home feed's permanent replacement: with no fixtures left to show, this
// card closes the on-pitch tournament — world champion and golden boot. The
// pool winner lives in the ChampionHero at the top of the page.
export default function TournamentWrapCard({ results }: Props) {
  const champion = results.champion ? TEAMS[results.champion] : undefined

  const bootWinners = Array.isArray(results.goldenBootWinner)
    ? results.goldenBootWinner
    : results.goldenBootWinner ? [results.goldenBootWinner] : []
  const bootGoals = bootWinners[0] ? results.playerGoals?.[bootWinners[0]] : undefined

  return (
    <section className="wrap-card" dir="rtl" data-testid="tournament-wrap">
      <div className="wrap-card__label">המונדיאל הסתיים</div>

      {champion && (
        <div className="wrap-card__champion">
          <span className="wrap-card__trophy" aria-hidden="true">🏆</span>
          {champion.iso && <span className={`fi fi-${champion.iso} fis wrap-card__flag`} aria-hidden="true" />}
          <div className="wrap-card__champion-name">{champion.he}</div>
          <div className="wrap-card__champion-sub">אלופת העולם 2026</div>
        </div>
      )}

      {bootWinners.length > 0 && (
        <p className="wrap-card__line">
          <span className="wrap-card__line-emoji" aria-hidden="true">⚽</span>
          נעל הזהב: <strong>{bootWinners.join(' + ')}</strong>
          {bootGoals != null && ` — ${bootGoals} שערים`}
        </p>
      )}

      <a className="wrap-card__link" href="/results">לכל התוצאות ›</a>
    </section>
  )
}

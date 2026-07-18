import { useMemo, useState, type ReactNode } from 'react'
import type { MatchScores, Score, TournamentResults } from '../../shared/types'
import type { User } from '../../users'
import { USERS } from '../../users'
import {
  getRemaining,
  computeBaseTotals,
  baseRanking,
  projectProvisional,
  simulateChances,
  resolveScenario,
  computeReachability,
  bootInfo,
  winnerOf,
  teamHe,
  teamIso,
  type RemainingInfo,
  type ScenarioScores,
  type ReachStat,
  type EnteredFlags,
  type BootInfo,
} from './scenarios'

const MEDALS = ['🥇', '🥈', '🥉']
const MAX_GOALS = 9
const firstName = (label: string) => label.split(' ')[0]

function TeamChip({ team, big }: { team: string; big?: boolean }) {
  const iso = teamIso(team)
  return (
    <span className={`sc-team${big ? ' sc-team--big' : ''}`}>
      {iso && <span className={`fi fi-${iso} sc-team-flag`} aria-hidden="true" />}
      <span className="sc-team-name">{teamHe(team)}</span>
    </span>
  )
}

// A single-digit goal box you just type into (0–9). Starts empty (null) — no
// steppers and no pre-filled value, so each match begins as a blank slate.
function ScoreInput({ value, onChange, disabled, label }: { value: Score; onChange: (v: Score) => void; disabled?: boolean; label: string }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      className="sc-score-input"
      value={value == null ? '' : String(value)}
      disabled={disabled}
      aria-label={label}
      maxLength={1}
      placeholder="–"
      onFocus={e => e.currentTarget.select()}
      onChange={e => {
        const digit = e.target.value.replace(/\D/g, '').slice(-1)
        onChange(digit === '' ? null : Math.min(MAX_GOALS, Number(digit)))
      }}
    />
  )
}

// One match in the builder: two teams with a typeable goal box each, and — when the
// scoreline is level — an advancer toggle (a knockout can't truly draw). A match
// already played is locked to its real result; a match whose teams aren't known yet
// (the final/3rd place before the semis are set) is shown as pending.
function MatchBuilder({ title, home, away, scores, locked, pending, onChange }: {
  title: string
  home: string
  away: string
  scores: MatchScores
  locked: boolean
  pending?: boolean
  onChange: (s: MatchScores) => void
}) {
  const disabled = locked || !!pending
  const bothSet = scores.home != null && scores.away != null
  const draw = !pending && bothSet && scores.home === scores.away
  const winner = !pending && bothSet ? winnerOf(home, away, scores) : null
  const set = (patch: Partial<MatchScores>) => onChange({ ...scores, ...patch })
  const tag = locked ? 'שוחק' : pending ? 'ממתין לחצי הגמר' : !bothSet ? 'קבעו תוצאה' : draw ? 'שוויון — מי עולה?' : `עולה: ${teamHe(winner!)}`
  return (
    <div className={`sc-match${locked ? ' sc-match--locked' : ''}${pending ? ' sc-match--pending' : ''}`}>
      <div className="sc-match-head">
        <span className="sc-match-title">{title}</span>
        <span className="sc-match-tag">{tag}</span>
      </div>
      <div className="sc-match-line">
        <span className={`sc-side${winner === home ? ' sc-side--win' : ''}`}>{pending ? <span className="sc-team-tbd">{home}</span> : <TeamChip team={home} />}</span>
        <span className="sc-score">
          <ScoreInput value={pending ? null : scores.home} onChange={v => set({ home: v })} disabled={disabled} label={`שערי ${teamHe(home)}`} />
          <span className="sc-score-sep">:</span>
          <ScoreInput value={pending ? null : scores.away} onChange={v => set({ away: v })} disabled={disabled} label={`שערי ${teamHe(away)}`} />
        </span>
        <span className={`sc-side${winner === away ? ' sc-side--win' : ''}`}>{pending ? <span className="sc-team-tbd">{away}</span> : <TeamChip team={away} />}</span>
      </div>
      {draw && (
        <div className="sc-adv">
          <span className="sc-adv-label">עולה בפנדלים:</span>
          <button type="button" className={`sc-adv-btn${scores.drawWinner !== 'away' ? ' sc-adv-btn--on' : ''}`} disabled={disabled} onClick={() => set({ drawWinner: 'home' })}>{teamHe(home)}</button>
          <button type="button" className={`sc-adv-btn${scores.drawWinner === 'away' ? ' sc-adv-btn--on' : ''}`} disabled={disabled} onClick={() => set({ drawWinner: 'away' })}>{teamHe(away)}</button>
        </div>
      )}
    </div>
  )
}

function Move({ from, to }: { from: number; to: number }) {
  const d = from - to
  if (d === 0) return <span className="sc-move sc-move--flat">—</span>
  const up = d > 0
  return <span className={`sc-move sc-move--${up ? 'up' : 'down'}`}>{up ? '▲' : '▼'}{Math.abs(d)}</span>
}

function StandingsRow({ rank, label, pts, bonus, boot, baseRank, isMe, locked, open, onToggle, detail }: {
  rank: number; label: string; pts: number; bonus: number; boot: number; baseRank: number; isMe: boolean
  locked: boolean; open: boolean; onToggle: () => void; detail: ReactNode
}) {
  return (
    <>
      <tr
        className={`sc-row sc-row--click${isMe ? ' sc-row--me' : ''}${rank <= 3 ? ` sc-row--rank-${rank}` : ''}${locked ? ' sc-row--locked' : ''}${open ? ' sc-row--open' : ''}`}
        onClick={onToggle}
        aria-expanded={open}
      >
        <td className="sc-td sc-td--rank">{rank <= 3 ? MEDALS[rank - 1] : rank}</td>
        <td className="sc-td sc-td--name">
          <span className="sc-name">{label}</span>
          {isMe && <span className="lb-me-badge">אני</span>}
          {locked && <span className="sc-lockpos" title="המקום סגור — לא ישתנה עד סוף הטורניר">🔒</span>}
        </td>
        <td className="sc-td sc-td--move"><Move from={baseRank} to={rank} /></td>
        <td className="sc-td sc-td--bonus">
          {bonus > 0 ? <span className="sc-bonus">+{bonus}</span> : <span className="sc-bonus sc-bonus--zero">0</span>}
          {boot > 0 && <span className="sc-bonus sc-bonus--boot" title="בונוס נעל הזהב">⚽+{boot}</span>}
        </td>
        <td className="sc-td sc-td--pts">{pts}</td>
      </tr>
      {open && (
        <tr className="sc-row-detail">
          <td className="sc-td" colSpan={5}>{detail}</td>
        </tr>
      )}
    </>
  )
}

// One "pick" cell in the click-to-expand detail: a team chip plus, when the relevant
// match is already decided, a ✓/✗ for whether the bettor nailed it.
function PickCell({ label, team, ok }: { label: string; team?: string; ok?: boolean | null }) {
  return (
    <div className="sc-detail-cell">
      <span className="sc-detail-key">{label}</span>
      <span className="sc-detail-val">
        {team ? <TeamChip team={team} /> : <span className="sc-tbd">—</span>}
        {ok === true && <span className="sc-detail-ok" title="פגע">✓</span>}
        {ok === false && <span className="sc-detail-no" title="פספס">✗</span>}
      </span>
    </div>
  )
}

const REACH_TONES = ['gold', 'silver', 'bronze', 'green', 'amber'] as const

// One "who can still finish exactly here" card for a single finishing position (1-5).
// A bettor is 🔒 in a position only when their rank is fully pinned there (min === max === pos).
function ReachGroup({ position, stats }: { position: number; stats: ReachStat[] }) {
  if (!stats.length) return null
  const tone = REACH_TONES[position - 1] ?? 'amber'
  const medal = position <= 3 ? MEDALS[position - 1] : null
  const anyLocked = stats.some(s => s.minRank === s.maxRank && s.minRank === position)
  return (
    <div className={`sc-reach-group sc-reach-group--${tone}`}>
      <div className="sc-reach-title">{medal && <span aria-hidden>{medal}</span>}מקום {position}<span className="sc-reach-count">{stats.length}</span></div>
      <div className="sc-reach-names">
        {stats.map(s => {
          const locked = s.minRank === s.maxRank && s.minRank === position
          return (
            <span key={s.label} className={`sc-reach-chip${locked ? ' sc-reach-chip--locked' : ''}`} title={locked ? 'מובטח — כבר נעול בדיוק במקום הזה' : undefined}>
              {firstName(s.label)}{locked && <span className="sc-lockpos" aria-label="נעול"> 🔒</span>}
            </span>
          )
        })}
      </div>
      {anyLocked && <div className="sc-reach-hint">🔒 = כבר סגור בדיוק במקום הזה.</div>}
    </div>
  )
}

function Explorer({ users, info, base, baseRank, boot, me }: {
  users: User[]; info: RemainingInfo; base: Map<string, number>; baseRank: Map<string, number>; boot: BootInfo; me?: string
}) {
  const [sf1, sf2] = info.sf
  const dflt = (locked: MatchScores | null): MatchScores => locked ?? { home: null, away: null, drawWinner: 'home' }

  const [sfScores, setSfScores] = useState<[MatchScores, MatchScores]>([dflt(sf1.scores), dflt(sf2.scores)])
  const [finalScore, setFinalScore] = useState<MatchScores>(dflt(info.finalScores))
  const [thirdScore, setThirdScore] = useState<MatchScores>(dflt(info.thirdScores))
  const [showFull, setShowFull] = useState(false)
  // Projected golden-boot winner (default = current leader). null = an unpicked player wins → nobody gets +10.
  const [bootWinner, setBootWinner] = useState<string | null>(boot.leader)
  // Projected FINAL goal tally for the boot winner. Goals beyond his current count pay his
  // backers +3 each (POINTS_PER_GOAL), so choosing a lower-tally player only helps once you
  // give him enough goals to actually overtake the leader.
  const [bootGoals, setBootGoals] = useState<number>(boot.leader ? boot.goals[boot.leader] ?? 0 : 0)
  const pickBoot = (name: string | null) => {
    setBootWinner(name)
    setBootGoals(name ? boot.goals[name] ?? 0 : 0)
  }

  const [openBoot, setOpenBoot] = useState<string | null>(null)

  // Real, decided matches always win over local edits: as the tournament progresses the
  // finished results are pinned to their actual score (and can't be changed), while the
  // still-open matches keep whatever the user is exploring. This keeps the simulator in
  // sync with the live bracket even if a match ends while the page is open.
  const sf1Locked = sf1.winner !== null && !!sf1.scores
  const sf2Locked = sf2.winner !== null && !!sf2.scores
  const finalLocked = !info.finalOpen && !!info.finalScores
  const thirdLocked = !info.thirdOpen && !!info.thirdScores
  const effSf: [MatchScores, MatchScores] = [
    sf1Locked ? sf1.scores! : sfScores[0],
    sf2Locked ? sf2.scores! : sfScores[1],
  ]
  const effFinal = finalLocked ? info.finalScores! : finalScore
  const effThird = thirdLocked ? info.thirdScores! : thirdScore

  const bothSet = (s: MatchScores) => s.home != null && s.away != null
  const entered: EnteredFlags = {
    sf: [bothSet(effSf[0]), bothSet(effSf[1])],
    final: bothSet(effFinal),
    third: bothSet(effThird),
  }
  const anyEntered = entered.sf[0] || entered.sf[1] || entered.final || entered.third
  const allEntered = entered.sf[0] && entered.sf[1] && entered.final && entered.third
  const sfsKnown = info.sf.every((s, i) => s.winner !== null || entered.sf[i])
  // Hypotheticals the user typed for still-open matches (as opposed to pinned real results).
  const userEntered =
    (!sf1Locked && bothSet(sfScores[0])) ||
    (!sf2Locked && bothSet(sfScores[1])) ||
    (!finalLocked && bothSet(finalScore)) ||
    (!thirdLocked && bothSet(thirdScore))

  const scenario: ScenarioScores = { sf: effSf, final: effFinal, third: effThird }
  const scKey = JSON.stringify(scenario)
  const bootCands = boot.sweep
  const resolved = useMemo(() => resolveScenario(info, scenario), [info, scKey])
  // Only goals beyond the boot king's current tally are new points; picking a name never
  // removes the goals already banked in `base`.
  const bootCurGoals = bootWinner ? boot.goals[bootWinner] ?? 0 : 0
  const bootExtraGoals = Math.max(0, bootGoals - bootCurGoals)
  const bootPicked = !!bootWinner && (boot.options.find(o => o.name === bootWinner)?.picked ?? false)
  // Most goals any *other* contender has: the projected king only actually wins (and pays +10)
  // once his goals reach that bar. A chaser left at his current tally can't be king.
  const bootRivalMax = bootWinner
    ? Math.max(0, ...Object.entries(boot.goals).filter(([n]) => n !== bootWinner).map(([, g]) => g))
    : 0
  const bootIsKing = bootPicked && bootGoals >= bootRivalMax
  // Projected final goals: the selected king takes the stepper value, everyone else keeps their
  // current tally. Whoever ends at the top total (co-)wins — a tie means *several* winners, and
  // every picked co-winner's backers earn +10 (exactly what the points engine does for ties).
  const projGoals: Record<string, number> = { ...boot.goals }
  if (bootWinner) projGoals[bootWinner] = bootGoals
  const projMax = Math.max(0, ...Object.values(projGoals))
  const pickedNames = new Set(users.map(u => u.topGoalscorer))
  const bootBonusWinners = projMax > 0 ? Object.keys(projGoals).filter(n => projGoals[n] === projMax && pickedNames.has(n)) : []
  const bootBonusKey = bootBonusWinners.join('|')
  // Anyone (picked or not) sitting at the top projected total (co-)wins the boot in this scenario.
  const isBootWinner = (name: string) => projMax > 0 && (name === bootWinner ? bootGoals : boot.goals[name] ?? 0) === projMax
  const rows = useMemo(() => projectProvisional(users, base, info, scenario, entered, bootBonusWinners, bootExtraGoals, bootWinner), [users, base, info, scKey, bootWinner, bootExtraGoals, bootBonusKey])
  // Two reachability views, differing only in how they treat the still-undecided golden boot:
  //  • `reach` sweeps EVERY possible boot winner — powers the "who can finish where" cards,
  //    which must still reveal that e.g. Kane taking the boot could drop you.
  //  • `reachSel` pins the boot to the winner you've selected in the scenario (default = current
  //    leader), exactly like an entered match result. So the live-table / odds locks reflect the
  //    full what-if you built: pin a non-Kane boot and a #2 only Kane could break reads as locked
  //    (100%🔒) instead of being capped at 99% for a boot swing you've already ruled out.
  const reach = useMemo(() => computeReachability(users, base, info, bootCands, scenario, entered), [users, base, info, bootCands, scKey])
  const reachSel = useMemo(() => computeReachability(users, base, info, [bootWinner], scenario, entered), [users, base, info, bootWinner, scKey])

  // Everything a bettor picked that still matters at the end — surfaced on click.
  const detailsOf = useMemo(
    () =>
      new Map(
        users.map(u => {
          const bracketFinal = (u.knockoutStages?.final ?? []).flatMap(m => [m.home, m.away]).filter(Boolean) as string[]
          const final = u.predictedFinalTeams && u.predictedFinalTeams.length ? u.predictedFinalTeams : bracketFinal
          return [u.label, { champion: u.predictedChampion, third: u.predictedThirdPlaceWinner, final, boot: u.topGoalscorer }]
        }),
      ),
    [users],
  )
  // A row's shown position is final only if it can't move — clinched AND already at that rank.
  // reachSel is conditioned on the entered results *and the pinned boot*, so min===max means
  // "locked given what's in, under the boot you projected". Once everything is entered every
  // position is trivially "locked", so we don't badge those.
  const lockedAt = (label: string, rank: number) => {
    if (allEntered) return false
    const s = reachSel.stats.get(label)
    return !!s && s.minRank === s.maxRank && s.minRank === rank
  }

  const shown = showFull ? rows : rows.slice(0, 5)
  const podium = rows.slice(0, 3)
  const meRow = me ? rows.find(r => r.label === me) : undefined
  const meBaseRank = me ? baseRank.get(me) : undefined
  const meOutsideTop = !!(meRow && !showFull && meRow.rank > 5)

  const setSf = (i: 0 | 1, s: MatchScores) => setSfScores(prev => (i === 0 ? [s, prev[1]] : [prev[0], s]))
  const applyScenario = (label: string) => {
    const sc = reach.bestScenario.get(label)
    if (!sc) return
    setSfScores([sc.sf[0], sc.sf[1]])
    setFinalScore(sc.final)
    setThirdScore(sc.third)
    const bb = reach.bestBoot.get(label)
    if (bb) pickBoot(bb) // only auto-select a named winner; "nobody wins" has no picker anymore
  }
  const resetScores = () => {
    setSfScores([dflt(sf1.scores), dflt(sf2.scores)])
    setFinalScore(dflt(info.finalScores))
    setThirdScore(dflt(info.thirdScores))
    pickBoot(boot.leader)
  }

  const contenders = reach.contenders
  // One list per finishing position (1-5): everyone who can still land *exactly* there in some
  // remaining-match combination. A bettor who can finish 2nd–4th shows up in all three cards —
  // that spread is the point. Sorted by best-case rank, then base points.
  const byPosition = useMemo(
    () =>
      [1, 2, 3, 4, 5].map(pos =>
        [...reach.stats.values()]
          .filter(s => s.finishRanks.includes(pos))
          .sort((a, b) => a.minRank - b.minRank || b.basePts - a.basePts),
      ),
    [reach],
  )

  // Current standings position per bettor (from the live table) — shown beside the name in the
  // odds list, which is sorted by win chance, so it's clear who's climbing/falling.
  const rankOf = new Map(rows.map(r => [r.label, r.rank]))
  // Live model-based odds for #1 / top-3, conditioned on whatever results are entered.
  const chances = useMemo(() => simulateChances(users, base, info, scenario, entered, bootBonusWinners, bootExtraGoals, bootWinner), [users, base, info, scKey, bootWinner, bootExtraGoals, bootBonusKey])
  const EMPTY_CH = { p1: 0, pos: [0, 0, 0, 0, 0] }
  const oddsRanked = useMemo(
    () =>
      users
        .map(u => ({ label: u.label, ...(chances.get(u.label) ?? EMPTY_CH) }))
        .filter(o => o.pos.reduce((s, x) => s + x, 0) >= 0.005) // any shot at the top 5
        .sort((a, b) => {
          for (let k = 0; k < 5; k++) { const d = b.pos[k] - a.pos[k]; if (Math.abs(d) > 1e-9) return d }
          return a.label.localeCompare(b.label, 'he')
        }),
    [chances, users],
  )
  const oddsList = oddsRanked.slice(0, 5)
  // keep the picked player visible even when they've dropped out of the top 5
  const meOdds =
    me && !oddsList.some(o => o.label === me)
      ? oddsRanked.find(o => o.label === me) ?? { label: me, ...(chances.get(me) ?? EMPTY_CH) }
      : null
  const pct = (p: number) => (p >= 0.995 ? '100%' : p >= 0.005 ? `${Math.round(p * 100)}%` : p > 0 ? '<1%' : '—')
  // A single cell = the sampled probability of finishing EXACTLY at `position`. When the
  // deterministic sweep (under the pinned boot) fixes the bettor to exactly that rank
  // (min === max === position) it's a certainty → 100% + 🔒. Probabilities that round to 100%
  // without such a lock are capped at 99% so the odds never claim a guarantee the sweep didn't
  // confirm; unreachable ranks show "—".
  const oddsCell = (label: string, p: number, position: number): ReactNode => {
    const s = reachSel.stats.get(label)
    if (s && s.minRank === s.maxRank && s.minRank === position) {
      return <>100%<span className="sc-odds-lock" aria-label="נעול"> 🔒</span></>
    }
    if (p <= 0) return '—'
    return p >= 0.995 ? '99%' : pct(p)
  }
  const POSITIONS = [1, 2, 3, 4, 5]

  const championDecided = !info.finalOpen || (entered.final && sfsKnown)
  const thirdDecided = !info.thirdOpen || (entered.third && sfsKnown)

  // The click-to-expand card: everything a bettor picked that still moves points —
  // champion, the final pair, third place and their golden-boot pick (with live goals).
  const renderDetail = (label: string): ReactNode => {
    const d = detailsOf.get(label)
    if (!d) return null
    const champOk = championDecided && d.champion ? d.champion === resolved.champion : null
    const thirdOk = thirdDecided && d.third ? d.third === resolved.thirdWinner : null
    const bootG = boot.goals[d.boot] ?? 0
    return (
      <div className="sc-detail-grid">
        <PickCell label="אלופה" team={d.champion} ok={champOk} />
        <div className="sc-detail-cell">
          <span className="sc-detail-key">גמר</span>
          <span className="sc-detail-val sc-detail-final">
            {d.final[0] ? <TeamChip team={d.final[0]} /> : <span className="sc-tbd">—</span>}
            <span className="sc-detail-vs">–</span>
            {d.final[1] ? <TeamChip team={d.final[1]} /> : <span className="sc-tbd">—</span>}
          </span>
        </div>
        <PickCell label="מקום שלישי" team={d.third} ok={thirdOk} />
        <div className="sc-detail-cell">
          <span className="sc-detail-key">מלך השערים</span>
          <span className="sc-detail-val">
            <span className="sc-detail-boot">⚽ {d.boot} <span className="sc-detail-goals">({bootG})</span></span>
            {d.boot && bootBonusWinners.includes(d.boot) && <span className="sc-boot-badge" title="מקבל +10 בתרחיש הנוכחי">+10</span>}
          </span>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* title race — live model-based odds for #1 / top-3 */}
      <section className="sc-headline" dir="rtl">
        <h3 className="sc-headline-title">{contenders.length === 1 ? 'האליפות כמעט הוכרעה' : 'מרוץ הסיום — הסיכויים'}</h3>
        <p className="sc-headline-lead">
          {anyEntered
            ? <>הסיכוי לסיים בכל מקום (1–5) לפי התוצאות עד כה. שנו תוצאה למטה והם יתעדכנו.</>
            : <>הסיכוי לסיים בכל מקום (<b>1–5</b>) לפי מודל הכוח. הזינו תוצאות לעדכון, או לחצו על שם לתרחיש הטוב עבורו.</>}
        </p>
        <div className="sc-odds">
          <div className="sc-odds-head">
            <span className="sc-odds-name-h">מהמר</span>
            {POSITIONS.map(pos => <span key={pos} className="sc-odds-col-h">{pos <= 3 ? MEDALS[pos - 1] : pos}</span>)}
          </div>
          {oddsList.map(o => (
            <button
              key={o.label}
              type="button"
              className={`sc-odds-row${o.label === me ? ' sc-odds-row--me' : ''}`}
              onClick={() => applyScenario(o.label)}
              title="טען תרחיש טוב עבורו"
            >
              <span className="sc-odds-name"><span className="sc-odds-rank" title="מיקום נוכחי בטבלה">{rankOf.get(o.label)}</span><span className="sc-odds-nm">{firstName(o.label)}</span>{o.label === me && <span className="lb-me-badge">אני</span>}</span>
              {POSITIONS.map(pos => <span key={pos} className="sc-odds-p">{oddsCell(o.label, o.pos[pos - 1], pos)}</span>)}
            </button>
          ))}
          {meOdds && (
            <>
              <div className="sc-odds-gap" aria-hidden />
              <button
                type="button"
                className="sc-odds-row sc-odds-row--me"
                onClick={() => applyScenario(meOdds.label)}
                title="טען תרחיש טוב עבורו"
              >
                <span className="sc-odds-name"><span className="sc-odds-rank" title="מיקום נוכחי בטבלה">{rankOf.get(meOdds.label)}</span><span className="sc-odds-nm">{firstName(meOdds.label)}</span><span className="lb-me-badge">אני</span></span>
                {POSITIONS.map(pos => <span key={pos} className="sc-odds-p">{oddsCell(meOdds.label, meOdds.pos[pos - 1], pos)}</span>)}
              </button>
            </>
          )}
        </div>
      </section>

      {/* the builder */}
      <section className="sc-bracket" dir="rtl" aria-label="בונה תרחישים">
        <div className="sc-bracket-head">
          <span className="sc-bracket-title">בנו תרחיש — קבעו את התוצאה של כל משחק</span>
          <span className="sc-bracket-sub">התוצאה המדויקת קובעת גם פגיעות/צליפות, לא רק מי עולה</span>
          {userEntered && (
            <button type="button" className="sc-reset" onClick={resetScores}>↺ אפס תוצאות</button>
          )}
        </div>
        <div className="sc-bracket-grid">
          <MatchBuilder title="חצי גמר 1" home={sf1.teams[0]} away={sf1.teams[1]} scores={effSf[0]} locked={sf1Locked} onChange={s => setSf(0, s)} />
          <MatchBuilder title="חצי גמר 2" home={sf2.teams[0]} away={sf2.teams[1]} scores={effSf[1]} locked={sf2Locked} onChange={s => setSf(1, s)} />
          <MatchBuilder
            title="מקום שלישי"
            home={sfsKnown ? resolved.losers[0] : 'מפסידת חצי גמר 1'}
            away={sfsKnown ? resolved.losers[1] : 'מפסידת חצי גמר 2'}
            scores={effThird}
            locked={thirdLocked}
            pending={info.thirdOpen && !sfsKnown}
            onChange={setThirdScore}
          />
          <MatchBuilder
            title="גמר"
            home={sfsKnown ? resolved.finalists[0] : 'מנצחת חצי גמר 1'}
            away={sfsKnown ? resolved.finalists[1] : 'מנצחת חצי גמר 2'}
            scores={effFinal}
            locked={finalLocked}
            pending={info.finalOpen && !sfsKnown}
            onChange={setFinalScore}
          />
        </div>
        <div className="sc-boot-pick">
          <div className="sc-boot-pick-head">
            <span className="sc-boot-pick-title">⚽ נעל הזהב — מי יזכה?</span>
            <span className="sc-boot-pick-sub">מי שהימר על הזוכה מקבל <b>+10</b> ועוד <b>+3</b> לכל גול שלו. תיקו בראש = <b>כולם זוכים</b>. אם מוביל שלא נבחר זוכה — אף אחד לא מקבל.</span>
          </div>
          <div className="sc-boot-opts">
            {boot.options.map(o => (
              <button
                key={o.name}
                type="button"
                className={`sc-boot-opt${bootWinner === o.name ? ' sc-boot-opt--on' : ''}${isBootWinner(o.name) ? ' sc-boot-opt--win' : ''}${o.picked ? '' : ' sc-boot-opt--unpicked'}`}
                onClick={() => pickBoot(o.name)}
                title={o.picked ? (o.alive ? 'נבחר על ידי מהמרים — זכייה שלו נותנת להם +10' : 'הנבחרת שלו הודחה') : 'לא נבחר על ידי אף אחד — זכייה שלו = אף אחד לא מקבל בונוס'}
              >
                {isBootWinner(o.name) && <span className="sc-boot-opt-king" title="זוכה נעל הזהב בתרחיש הזה" aria-label="זוכה">👑</span>}
                <span className="sc-boot-opt-name">{o.name}</span>
                <span className="sc-boot-opt-g">{o.name === bootWinner ? bootGoals : o.goals}</span>
                {!o.picked && <span className="sc-boot-opt-tag">לא נבחר</span>}
                {!o.alive && <span className="sc-boot-opt-out" aria-label="הודחה">❄</span>}
              </button>
            ))}
          </div>
          {bootPicked && (
            <div className="sc-boot-goals">
              <span className="sc-boot-goals-label">כמה גולים יסיים <b>{bootWinner}</b>?</span>
              <div className="sc-boot-goals-ctl">
                <button type="button" className="sc-boot-goals-btn" onClick={() => setBootGoals(g => Math.min(bootCurGoals + 9, g + 1))} aria-label="עוד גול">+</button>
                <span className="sc-boot-goals-val">{bootGoals}</span>
                <button type="button" className="sc-boot-goals-btn" onClick={() => setBootGoals(g => Math.max(bootCurGoals, g - 1))} disabled={bootGoals <= bootCurGoals} aria-label="פחות גולים">−</button>
              </div>
              <span className={`sc-boot-goals-hint${bootIsKing ? '' : ' sc-boot-goals-hint--warn'}`}>
                {!bootIsKing
                  ? <>לא מספיק כדי לזכות — צריך <b>{bootRivalMax}</b> גולים לפחות{bootExtraGoals > 0 && <> (אבל +{bootExtraGoals * 3} על הגולים הנוספים)</>}</>
                  : bootExtraGoals > 0
                    ? <>מקבל <b>+{10 + bootExtraGoals * 3}</b> למי שהימר עליו (10 נעל + {bootExtraGoals * 3} על {bootExtraGoals} גולים)</>
                    : <>מקבל <b>+10</b> · כל גול נוסף = +3 למי שהימר עליו</>}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* the live table — updates after every single result */}
      <section className="sc-result" dir="rtl">
        <div className="sc-result-head">
          <h3 className="sc-result-title">{anyEntered ? 'הטבלה החיה' : 'הטבלה כרגע'}</h3>
          <p className="sc-result-lead">
            אלופה: {info.finalOpen && !(entered.final && sfsKnown) ? <span className="sc-tbd">טרם הוכרע</span> : <TeamChip team={resolved.champion} />}
            {' · '}מדליה: {info.thirdOpen && !(entered.third && sfsKnown) ? <span className="sc-tbd">טרם הוכרע</span> : <TeamChip team={resolved.thirdWinner} />}
            {meRow && meBaseRank && <> · אתה: מקום <b>{meRow.rank}</b> <Move from={meBaseRank} to={meRow.rank} />{lockedAt(me!, meRow.rank) && <span className="sc-lockpos" title="המקום שלך סגור"> 🔒</span>}</>}
          </p>
        </div>
        <div className="sc-podium">
          {podium.map(r => {
            const locked = lockedAt(r.label, r.rank)
            return (
              <div
                key={r.label}
                className={`sc-podium-card sc-podium-card--${r.rank}${r.label === me ? ' sc-podium-card--me' : ''}${locked ? ' sc-podium-card--locked' : ''}${openBoot === r.label ? ' sc-podium-card--open' : ''}`}
                onClick={() => setOpenBoot(v => (v === r.label ? null : r.label))}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenBoot(v => (v === r.label ? null : r.label)) } }}
                role="button"
                tabIndex={0}
                aria-label={`${r.label} — ${r.pts} נקודות`}
              >
                <div className="sc-podium-medal">{MEDALS[r.rank - 1]}{locked && <span className="sc-podium-lock" title="המקום סגור">🔒</span>}</div>
                <div className="sc-podium-name">{r.label}{r.label === me && <span className="lb-me-badge">אני</span>}</div>
                <div className="sc-podium-pts">{r.pts} <span className="sc-podium-unit">נק׳</span></div>
                <div className="sc-podium-move"><Move from={baseRank.get(r.label) ?? r.rank} to={r.rank} /> {r.bonus > 0 && <span className="sc-bonus">+{r.bonus}</span>}{r.boot > 0 && <span className="sc-bonus sc-bonus--boot">⚽+{r.boot}</span>}</div>
              </div>
            )
          })}
        </div>
        {/* the open podium player's detail, full-width below the (narrow) cards so it reads
            cleanly on mobile instead of being crammed into a third of the row */}
        {podium.some(r => r.label === openBoot) && openBoot && (
          <div className="sc-podium-detail-panel" dir="rtl">
            <div className="sc-podium-detail-name">{openBoot}{openBoot === me && <span className="lb-me-badge">אני</span>}</div>
            {renderDetail(openBoot)}
          </div>
        )}

        <table className="sc-table">
          <thead>
            <tr>
              <th className="sc-th sc-th--rank">#</th>
              <th className="sc-th sc-th--name">מהמר</th>
              <th className="sc-th sc-th--move">תזוזה</th>
              <th className="sc-th sc-th--bonus">מהמשחקים</th>
              <th className="sc-th sc-th--pts">נק׳</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(r => (
              <StandingsRow
                key={r.label}
                rank={r.rank}
                label={r.label}
                pts={r.pts}
                bonus={r.bonus}
                boot={r.boot}
                baseRank={baseRank.get(r.label) ?? r.rank}
                isMe={r.label === me}
                locked={lockedAt(r.label, r.rank)}
                open={openBoot === r.label}
                onToggle={() => setOpenBoot(v => (v === r.label ? null : r.label))}
                detail={renderDetail(r.label)}
              />
            ))}
            {meOutsideTop && meRow && (
              <>
                <tr className="sc-row-gap"><td colSpan={5} /></tr>
                <StandingsRow
                  rank={meRow.rank}
                  label={meRow.label}
                  pts={meRow.pts}
                  bonus={meRow.bonus}
                  boot={meRow.boot}
                  baseRank={baseRank.get(meRow.label) ?? meRow.rank}
                  isMe
                  locked={lockedAt(meRow.label, meRow.rank)}
                  open={openBoot === meRow.label}
                  onToggle={() => setOpenBoot(v => (v === meRow.label ? null : meRow.label))}
                  detail={renderDetail(meRow.label)}
                />
              </>
            )}
          </tbody>
        </table>
        <p className="sc-hint-click">לחצו על מהמר לפרטים: אלופה, גמר, מקום שלישי ומלך השערים · 🔒 = המקום כבר סגור</p>
        <button type="button" className="sc-toggle" onClick={() => setShowFull(v => !v)} aria-expanded={showFull}>
          {showFull ? 'הצג רק את הטופ 5' : 'הצג את הטבלה המלאה'}
        </button>
      </section>

      {/* reachability across every possible outcome */}
      <section className="sc-reach" dir="rtl">
        <div className="sc-reach-head">
          <h3 className="sc-reach-title-main">מי יכול לסיים בכל מקום (1–5)</h3>
          <p className="sc-reach-sub">{anyEntered
            ? <>לכל מקום — מי עוד יכול לסיים בו בדיוק, על פני כל שילוב של המשחקים שנותרו בהינתן מה שהזנתם (כולל תוצאות מדויקות ונעל הזהב). מהמר שיכול לכמה מקומות מופיע בכולם. 🔒 = כבר סגור בדיוק שם.</>
            : <>לכל מקום — מי עוד יכול לסיים בו בדיוק, על פני כל שילוב של תוצאות בארבעת המשחקים (כולל תוצאות מדויקות ונעל הזהב). מהמר שיכול לכמה מקומות מופיע בכולם. הזינו תוצאות והרשימות יצטמצמו.</>}</p>
        </div>
        {byPosition.map((stats, i) => (
          <ReachGroup key={i + 1} position={i + 1} stats={stats} />
        ))}
      </section>

      <p className="lb-prob-note">
        <b>איך זה עובד:</b> קבעו תוצאה מדויקת לכל משחק — <b>הטבלה מתעדכנת אחרי כל תוצאה</b> וכוללת הכל: פגיעה/צליפה, גמר, אלופה, מדליה ו<b>נעל הזהב (+10)</b>.
        {' '}בחרו מי יזכה בנעל (ברירת מחדל — המוביל כרגע). 🔒 = המקום כבר סגור. לחיצה על מהמר מציגה את כל הימוריו.
      </p>
    </>
  )
}

// "מה אם" — the end-game scenario explorer. Deterministic and exact: pick the score of
// each remaining match and the whole board (podium, top 5, full table) recomputes, and a
// full sweep of every outcome shows who can still reach #1 / the podium / the top 5.
export default function WhatIfChampionView({ results, me, users, bootRace, teamByPlayer }: {
  results: TournamentResults; me?: string; users?: User[]
  // Live golden-boot race (Hebrew name → current goals, incl. unpicked leaders) and a
  // name→team map, so the boot picture can show real unpicked leaders. Optional: without
  // them we fall back to the picked scorers' tallies.
  bootRace?: Record<string, number>; teamByPlayer?: Record<string, string>
}) {
  const roster = users && users.length ? users : USERS
  const info = useMemo(() => getRemaining(results), [results])
  const base = useMemo(() => computeBaseTotals(roster, results), [roster, results])
  const baseRank = useMemo(() => baseRanking(roster, base), [roster, base])
  const boot = useMemo(() => bootInfo(roster, results, info, { race: bootRace, teamByPlayer }), [roster, results, info, bootRace, teamByPlayer])

  return (
    <div className="lb-prob lb-prob--scenarios">
      {!info.valid ? (
        <div className="lb-prob lb-prob--msg">התרחישים ייפתחו כשייקבעו זוגות חצי הגמר — עדיין מוקדם מדי.</div>
      ) : !info.anyRemaining ? (
        <div className="lb-prob lb-prob--msg">הטורניר הוכרע — אין עוד משחקים שישנו את הטבלה.</div>
      ) : (
        <Explorer users={roster} info={info} base={base} baseRank={baseRank} boot={boot} me={me} />
      )}
    </div>
  )
}

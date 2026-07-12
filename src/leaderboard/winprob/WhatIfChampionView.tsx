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

function ReachGroup({ title, hint, stats, tone, limit }: { title: string; hint: string; stats: ReachStat[]; tone: 'gold' | 'green' | 'amber'; limit: 1 | 3 | 5 }) {
  if (!stats.length) return null
  return (
    <div className={`sc-reach-group sc-reach-group--${tone}`}>
      <div className="sc-reach-title">{title}<span className="sc-reach-count">{stats.length}</span></div>
      <div className="sc-reach-names">
        {stats.map(s => (
          <span key={s.label} className={`sc-reach-chip${s.maxRank <= limit ? ' sc-reach-chip--locked' : ''}`} title={s.maxRank <= limit ? 'מובטח — נעול' : undefined}>
            {firstName(s.label)}{s.maxRank <= limit && <span className="sc-lockpos" aria-label="נעול"> 🔒</span>}
          </span>
        ))}
      </div>
      <div className="sc-reach-hint">{hint}</div>
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
  const rows = useMemo(() => projectProvisional(users, base, info, scenario, entered, bootWinner), [users, base, info, scKey, bootWinner])
  // Reachability & locks sweep every boot outcome too — a position is only truly "in reach"
  // (or clinched) once the ±10 boot swing is accounted for, not just the match results.
  // Conditioned on whatever's entered, so the cards narrow (and lock) alongside the live table
  // instead of always showing the from-scratch picture — which is what made them disagree.
  const reach = useMemo(() => computeReachability(users, base, info, bootCands, scenario, entered), [users, base, info, bootCands, scKey])

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
  // reach is conditioned on the entered results, so min===max means "locked given what's in".
  // Once everything is entered every position is trivially "locked", so we don't badge those.
  const lockedAt = (label: string, rank: number) => {
    if (allEntered) return false
    const s = reach.stats.get(label)
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
    if (reach.bestBoot.has(label)) setBootWinner(reach.bestBoot.get(label) ?? null)
  }
  const resetScores = () => {
    setSfScores([dflt(sf1.scores), dflt(sf2.scores)])
    setFinalScore(dflt(info.finalScores))
    setThirdScore(dflt(info.thirdScores))
    setBootWinner(boot.leader)
  }

  const contenders = reach.contenders
  // Show each bettor in every tier they can still reach, so someone who can win yet is already
  // guaranteed the podium shows as an *option* for #1 and *locked* (🔒) for top-3 — that's a
  // valid, informative state. We only drop them from a lower tier once they're locked into a
  // strictly better one (a guaranteed #1 shouldn't also read as a podium candidate).
  const top3 = useMemo(() => [...reach.stats.values()].filter(s => s.canTop3 && s.maxRank > 1).sort((a, b) => a.minRank - b.minRank || b.basePts - a.basePts), [reach])
  const top5only = useMemo(() => [...reach.stats.values()].filter(s => s.canTop5 && s.maxRank > 3).sort((a, b) => a.minRank - b.minRank || b.basePts - a.basePts), [reach])

  // Live model-based odds for #1 / top-3, conditioned on whatever results are entered.
  const chances = useMemo(() => simulateChances(users, base, info, scenario, entered, bootWinner), [users, base, info, scKey, bootWinner])
  const oddsRanked = useMemo(
    () =>
      users
        .map(u => ({ label: u.label, ...(chances.get(u.label) ?? { p1: 0, p3: 0, p5: 0 }) }))
        .filter(o => o.p5 >= 0.005)
        .sort((a, b) => b.p1 - a.p1 || b.p3 - a.p3 || b.p5 - a.p5 || a.label.localeCompare(b.label, 'he')),
    [chances, users],
  )
  const oddsList = oddsRanked.slice(0, 5)
  // keep the picked player visible even when they've dropped out of the top 5
  const meOdds =
    me && !oddsList.some(o => o.label === me)
      ? oddsRanked.find(o => o.label === me) ?? { label: me, ...(chances.get(me) ?? { p1: 0, p3: 0, p5: 0 }) }
      : null
  const pct = (p: number) => (p >= 0.995 ? '100%' : p >= 0.005 ? `${Math.round(p * 100)}%` : p > 0 ? '<1%' : '—')

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
            {bootWinner === d.boot && <span className="sc-boot-badge" title="מקבל +10 בתרחיש הנוכחי">+10</span>}
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
            ? <>הסיכויים לפי התוצאות עד כה. שנו תוצאה למטה והם יתעדכנו.</>
            : <>סיכויים ל<b>ראשון</b>, <b>טופ 3</b> ו<b>טופ 5</b> לפי מודל הכוח. הזינו תוצאות לעדכון, או לחצו על שם לתרחיש הטוב עבורו.</>}
        </p>
        <div className="sc-odds">
          <div className="sc-odds-head">
            <span className="sc-odds-name-h">מהמר</span>
            <span className="sc-odds-col-h">אלוף</span>
            <span className="sc-odds-col-h">טופ 3</span>
            <span className="sc-odds-col-h">טופ 5</span>
          </div>
          {oddsList.map(o => (
            <button
              key={o.label}
              type="button"
              className={`sc-odds-row${o.label === me ? ' sc-odds-row--me' : ''}`}
              onClick={() => applyScenario(o.label)}
              title="טען תרחיש טוב עבורו"
            >
              <span className="sc-odds-name">{firstName(o.label)}{o.label === me && <span className="lb-me-badge">אני</span>}</span>
              <span className="sc-odds-p1">{pct(o.p1)}</span>
              <span className="sc-odds-p3">{pct(o.p3)}</span>
              <span className="sc-odds-p5">{pct(o.p5)}</span>
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
                <span className="sc-odds-name">{firstName(meOdds.label)}<span className="lb-me-badge">אני</span></span>
                <span className="sc-odds-p1">{pct(meOdds.p1)}</span>
                <span className="sc-odds-p3">{pct(meOdds.p3)}</span>
                <span className="sc-odds-p5">{pct(meOdds.p5)}</span>
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
            title="גמר"
            home={sfsKnown ? resolved.finalists[0] : 'מנצחת חצי גמר 1'}
            away={sfsKnown ? resolved.finalists[1] : 'מנצחת חצי גמר 2'}
            scores={effFinal}
            locked={finalLocked}
            pending={info.finalOpen && !sfsKnown}
            onChange={setFinalScore}
          />
          <MatchBuilder
            title="מקום שלישי"
            home={sfsKnown ? resolved.losers[0] : 'מפסידת חצי גמר 1'}
            away={sfsKnown ? resolved.losers[1] : 'מפסידת חצי גמר 2'}
            scores={effThird}
            locked={thirdLocked}
            pending={info.thirdOpen && !sfsKnown}
            onChange={setThirdScore}
          />
        </div>
        <div className="sc-boot-pick">
          <div className="sc-boot-pick-head">
            <span className="sc-boot-pick-title">⚽ נעל הזהב — מי יזכה?</span>
            <span className="sc-boot-pick-sub">רק המועמדים שעדיין במירוץ. מי שהימר על מלך השערים מקבל <b>+10</b>; אם מוביל שלא נבחר זוכה — אף אחד לא מקבל.</span>
          </div>
          <div className="sc-boot-opts">
            {boot.options.map(o => (
              <button
                key={o.name}
                type="button"
                className={`sc-boot-opt${bootWinner === o.name ? ' sc-boot-opt--on' : ''}${o.picked ? '' : ' sc-boot-opt--unpicked'}`}
                onClick={() => setBootWinner(o.name)}
                title={o.picked ? (o.alive ? 'נבחר על ידי מהמרים — זכייה שלו נותנת להם +10' : 'הנבחרת שלו הודחה') : 'לא נבחר על ידי אף אחד — זכייה שלו = אף אחד לא מקבל בונוס'}
              >
                <span className="sc-boot-opt-name">{o.name}</span>
                <span className="sc-boot-opt-g">{o.goals}</span>
                {!o.picked && <span className="sc-boot-opt-tag">לא נבחר</span>}
                {!o.alive && <span className="sc-boot-opt-out" aria-label="הודחה">❄</span>}
              </button>
            ))}
            <button
              type="button"
              className={`sc-boot-opt${bootWinner === null ? ' sc-boot-opt--on' : ''} sc-boot-opt--unpicked`}
              onClick={() => setBootWinner(null)}
              title="שחקן אחר שלא ברשימה זוכה — אף אחד לא מקבל בונוס"
            >
              אחר / אף אחד
            </button>
          </div>
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
          <h3 className="sc-reach-title-main">מי עוד בפנים — על פני כל התרחישים</h3>
          <p className="sc-reach-sub">{anyEntered
            ? <>מחושב על כל שילוב אפשרי של המשחקים שנותרו, בהינתן התוצאות שהזנתם (כולל תוצאות מדויקות ונעל הזהב). 🔒 = מובטח, לא משנה איך שאר המשחקים ייגמרו.</>
            : <>מחושב על כל שילוב אפשרי של תוצאות בארבעת המשחקים (כולל תוצאות מדויקות ונעל הזהב). הזינו תוצאות והרשימות יצטמצמו. 🔒 = מובטח, לא משנה איך זה ייגמר.</>}</p>
        </div>
        <ReachGroup tone="gold" limit={1} title="יכולים לסיים ראשון" hint="🔒 = המקום הראשון כבר מובטח להם." stats={contenders} />
        <ReachGroup tone="green" limit={3} title="מועמדים לטופ 3" hint="🔒 = הפודיום כבר מובטח להם." stats={top3} />
        <ReachGroup tone="amber" limit={5} title="מועמדים לטופ 5" hint="🔒 = טופ 5 כבר מובטח להם." stats={top5only} />
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

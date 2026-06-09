import { useState, useEffect, useRef } from 'react'
import { TEAMS } from '../../shared/groups'
import './GroupVoteMatrix.css'
import './GroupAdvanceTable.css'

interface Props {
  r32Pickers: Record<string, string[]>
  allUserLabels: string[]
}

interface Popup {
  pickerList: string[]
  teamName: string
  inverted: boolean
  left: number
  top: number
  above: boolean
  arrowLeft: number
}

export default function GroupAdvanceTable({ r32Pickers, allUserLabels }: Props) {
  const totalUsers = allUserLabels.length
  const [popup, setPopup] = useState<Popup | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!popup) return
    const onMouseDown = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setPopup(null)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPopup(null) }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [popup])

  const openPopup = (e: React.MouseEvent<HTMLTableCellElement>, pickers: string[], teamName: string) => {
    if (!pickers.length) return
    const inverted = pickers.length > 20
    const pickerSet = new Set(pickers)
    const pickerList = inverted ? allUserLabels.filter(l => !pickerSet.has(l)) : pickers
    const rect = e.currentTarget.getBoundingClientRect()
    const popupWidth = 190
    const rawLeft = rect.left + rect.width / 2 - popupWidth / 2
    const clampedLeft = Math.max(8, Math.min(rawLeft, window.innerWidth - popupWidth - 8))
    const above = rect.bottom + 160 > window.innerHeight
    setPopup({
      pickerList,
      teamName,
      inverted,
      left: clampedLeft,
      top: above ? rect.top - 8 : rect.bottom + 8,
      above,
      arrowLeft: rect.left + rect.width / 2 - clampedLeft,
    })
  }

  const teams = Object.entries(r32Pickers)
    .sort((a, b) => b[1].length - a[1].length)

  if (teams.length === 0) return null

  return (
    <>
      <div className="advance-table-wrap">
        <table className="advance-table" dir="rtl">
          <thead>
            <tr>
              <th className="advance-th advance-th--team">נבחרת</th>
              <th className="advance-th">עלתה לשלב ה-32</th>
            </tr>
          </thead>
          <tbody>
            {teams.map(([team, pickers], i) => {
              const teamInfo = TEAMS[team]
              const teamName = teamInfo?.he ?? team
              const interactive = pickers.length > 0
              return (
                <tr key={team} className="advance-tr" style={{ '--row-i': i } as React.CSSProperties}>
                  <td className="advance-td advance-td--team">
                    <span className={`fi fi-${teamInfo?.iso ?? ''} gm-flag`} aria-hidden="true" />
                    <span>{teamName}</span>
                  </td>
                  <td
                    className={`advance-td${interactive ? ' gm-cell--interactive' : ''}`}
                    data-zero={!interactive || undefined}
                    onClick={interactive ? (e) => openPopup(e, pickers, teamName) : undefined}
                  >
                    <span className="advance-cell-count">{interactive ? pickers.length : '–'}</span>
                    <span className="advance-cell-total">/{totalUsers}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {popup && (
        <div
          ref={popupRef}
          className={`stage-popup${popup.above ? ' stage-popup--above' : ''}`}
          style={{
            left: popup.left,
            top: popup.above ? undefined : popup.top,
            bottom: popup.above ? window.innerHeight - popup.top : undefined,
            '--arrow-left': `${popup.arrowLeft}px`,
          } as React.CSSProperties}
        >
          <div className="stage-popup-header">
            <span className="stage-popup-team">{popup.teamName}</span>
            <span className="stage-popup-stage">{popup.inverted ? 'לא העלו לשלב ה-32' : 'עלתה לשלב ה-32'}</span>
          </div>
          <div className="stage-popup-pickers">
            {popup.pickerList.map(name => (
              <span key={name} className="stage-popup-picker">{name}</span>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

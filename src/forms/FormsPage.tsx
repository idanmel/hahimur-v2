import { useState, useRef, useEffect } from 'react'
import PredictionsView from '../predictionsView/PredictionsView'
import Nav from '../Nav'
import { predictions as talPredictions, topGoalscorer as talGoalscorer } from '../users/tal-lichter'
import { predictions as idanPredictions, topGoalscorer as idanGoalscorer } from '../users/idan-melamed'
import { predictions as alradPredictions, topGoalscorer as alradGoalscorer } from '../users/alrad-guma'

const USERS = [
  { label: 'טל ליכטר', number: '01', predictions: talPredictions, topGoalscorer: talGoalscorer },
  { label: 'עידן מלמד', number: '02', predictions: idanPredictions, topGoalscorer: idanGoalscorer },
  { label: 'אלרד גומא', number: '03', predictions: alradPredictions, topGoalscorer: alradGoalscorer },
]

export default function FormsPage() {
  const [selectedLabel, setSelectedLabel] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const selected = USERS.find(u => u.label === selectedLabel)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function select(label: string) {
    setSelectedLabel(label)
    setIsOpen(false)
  }

  return (
    <>
      <header className="poster-header">
        <div className="poster-bar poster-bar--top" />
        <div className="poster-center">
          <p className="poster-overline">גביע העולם FIFA</p>
          <div className="poster-mundial">MUNDIAL <span className="poster-year">2026</span></div>
          <h1 className="poster-subtitle">הטפסים</h1>
        </div>
        <div className="poster-bar poster-bar--bottom" />
      </header>
      <Nav />

      <main>
        <div className="user-picker" ref={pickerRef} dir="rtl">
          <button
            className={`user-picker__trigger${isOpen ? ' user-picker__trigger--open' : ''}${selected ? ' user-picker__trigger--filled' : ''}`}
            onClick={() => setIsOpen(o => !o)}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
          >
            {selected ? (
              <>
                <span className="user-picker__trigger-num">{selected.number}</span>
                <span className="user-picker__trigger-name">{selected.label}</span>
              </>
            ) : (
              <span className="user-picker__trigger-placeholder">בחר שחקן</span>
            )}
            <span className="user-picker__arrow" aria-hidden="true" />
          </button>

          {isOpen && (
            <div className="user-picker__menu" role="listbox" aria-label="בחר שחקן">
              {USERS.map(u => (
                <button
                  key={u.label}
                  role="option"
                  aria-selected={selectedLabel === u.label}
                  className={`user-picker__option${selectedLabel === u.label ? ' user-picker__option--selected' : ''}`}
                  onClick={() => select(u.label)}
                >
                  <span className="user-picker__option-num">{u.number}</span>
                  <span className="user-picker__option-name">{u.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <section>
            <PredictionsView predictions={selected.predictions} topGoalscorer={selected.topGoalscorer} />
          </section>
        )}
      </main>
    </>
  )
}

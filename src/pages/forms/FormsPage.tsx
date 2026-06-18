import { useState, useRef, useEffect } from 'react'
import type { User } from '../../users/index'
import FormView from '../../formView/FormView'
import PageLayout from '../../shared/PageLayout'
import { useCurrentUser } from '../../shared/useCurrentUser'
import PlayerSelect from './PlayerSelect'
import PlayerCompare from './PlayerCompare'

interface Props {
  users: User[]
  usersSorted: User[]
}

type Mode = 'single' | 'compare'

export default function FormsPage({ users, usersSorted }: Props) {
  const { me } = useCurrentUser()
  const [mode, setMode] = useState<Mode>('single')
  const [selectedLabel, setSelectedLabel] = useState(me)
  const [isOpen, setIsOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const selected = users.find(u => u.label === selectedLabel)

  const [labelA, setLabelA] = useState(me)
  const [labelB, setLabelB] = useState('')
  const playerA = users.find(u => u.label === labelA)
  const playerB = users.find(u => u.label === labelB)

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
    <PageLayout title="הטפסים">
      <main>
        <div className="pc-mode-toggle" dir="rtl">
          <button
            type="button"
            className={`pc-mode-btn${mode === 'single' ? ' pc-mode-btn--active' : ''}`}
            onClick={() => setMode('single')}
          >טופס</button>
          <button
            type="button"
            className={`pc-mode-btn${mode === 'compare' ? ' pc-mode-btn--active' : ''}`}
            onClick={() => setMode('compare')}
          >השוואה</button>
        </div>

        {mode === 'single' ? (
          <>
            <div className="user-picker" ref={pickerRef} dir="rtl">
              <button
                className={`user-picker__trigger${isOpen ? ' user-picker__trigger--open' : ''}${selected ? ' user-picker__trigger--filled' : ''}`}
                onClick={() => setIsOpen(o => !o)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
              >
                {selected ? (
                  <span className="user-picker__trigger-name">{selected.label}</span>
                ) : (
                  <span className="user-picker__trigger-placeholder">בחר שחקן</span>
                )}
                <span className="user-picker__arrow" aria-hidden="true" />
              </button>

              {isOpen && (
                <div className="user-picker__menu" role="listbox" aria-label="בחר שחקן">
                  {usersSorted.map(u => (
                    <button
                      key={u.label}
                      role="option"
                      aria-selected={selectedLabel === u.label}
                      className={`user-picker__option${selectedLabel === u.label ? ' user-picker__option--selected' : ''}`}
                      onClick={() => select(u.label)}
                    >
                      <span className="user-picker__option-name">{u.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selected && (
              <section>
                <FormView
                  predictions={selected.predictions}
                  topGoalscorer={selected.topGoalscorer}
                  groupTables={selected.groupTables}
                  thirdPlaceQualification={selected.thirdPlaceQualification}
                  knockoutStages={selected.knockoutStages}
                  predictedChampion={selected.predictedChampion}
                />
              </section>
            )}
          </>
        ) : (
          <>
            <div className="pc-pickers">
              <PlayerSelect
                users={usersSorted}
                value={labelA}
                onChange={setLabelA}
                excludeLabel={labelB}
                placeholder="שחקן ראשון"
                ariaLabel="בחר שחקן ראשון"
              />
              <PlayerSelect
                users={usersSorted}
                value={labelB}
                onChange={setLabelB}
                excludeLabel={labelA}
                placeholder="שחקן שני"
                ariaLabel="בחר שחקן שני"
              />
            </div>

            {playerA && playerB ? (
              <PlayerCompare userA={playerA} userB={playerB} allUsers={users} />
            ) : (
              <p className="pc-hint" dir="rtl">בחרו שני שחקנים כדי להשוות בין הטפסים</p>
            )}
          </>
        )}
      </main>
    </PageLayout>
  )
}

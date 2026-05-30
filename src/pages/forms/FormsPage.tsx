import { useState, useRef, useEffect } from 'react'
import type { User } from '../../users/index'
import FormView from '../../formView/FormView'
import PageLayout from '../../shared/PageLayout'

interface Props {
  users: User[]
  usersSorted: User[]
}

export default function FormsPage({ users, usersSorted }: Props) {
  const [selectedLabel, setSelectedLabel] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const selected = users.find(u => u.label === selectedLabel)

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
      </main>
    </PageLayout>
  )
}

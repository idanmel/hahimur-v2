import { useState, useRef, useEffect } from 'react'
import type { User } from '../../users/index'

interface Props {
  users: User[]
  value: string
  onChange: (label: string) => void
  excludeLabel?: string
  placeholder?: string
  ariaLabel?: string
}

export default function PlayerSelect({
  users,
  value,
  onChange,
  excludeLabel,
  placeholder = 'בחר שחקן',
  ariaLabel = 'בחר שחקן',
}: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selected = users.find(u => u.label === value)
  const options = users.filter(u => u.label !== excludeLabel)
  const q = query.trim()
  const filtered = q ? options.filter(u => u.label.includes(q)) : options

  // Close the menu and clear the search query in one place, so the reset never
  // has to happen as a synchronous setState inside an effect.
  function close() {
    setIsOpen(false)
    setQuery('')
  }

  function toggle() {
    if (isOpen) close()
    else setIsOpen(true)
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  // Focus the search box whenever the menu opens.
  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  function select(label: string) {
    onChange(label)
    close()
  }

  return (
    <div className="user-picker" ref={ref} dir="rtl">
      <button
        className={`user-picker__trigger${isOpen ? ' user-picker__trigger--open' : ''}${selected ? ' user-picker__trigger--filled' : ''}`}
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {selected ? (
          <span className="user-picker__trigger-name">{selected.label}</span>
        ) : (
          <span className="user-picker__trigger-placeholder">{placeholder}</span>
        )}
        <span className="user-picker__arrow" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="user-picker__menu">
          <div className="user-picker__search">
            <input
              ref={inputRef}
              type="text"
              className="user-picker__search-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && filtered.length > 0) select(filtered[0].label)
                else if (e.key === 'Escape') close()
              }}
              placeholder="חיפוש שחקן…"
              aria-label="חיפוש שחקן"
            />
          </div>
          <div className="user-picker__list" role="listbox" aria-label={ariaLabel}>
            {filtered.length === 0 ? (
              <div className="user-picker__empty">לא נמצאו שחקנים</div>
            ) : (
              filtered.map(u => (
                <button
                  key={u.label}
                  role="option"
                  aria-selected={value === u.label}
                  className={`user-picker__option${value === u.label ? ' user-picker__option--selected' : ''}`}
                  onClick={() => select(u.label)}
                >
                  <span className="user-picker__option-name">{u.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

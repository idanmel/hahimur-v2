import { useState, useEffect } from 'react'

const LINKS = [
  { href: '/', label: 'בית' },
  { href: '/form', label: 'הטופס' },
]

const ADMIN_LINKS = [
  { href: '/', label: 'בית' },
  { href: '/form', label: 'הטופס' },
  { href: '/forms', label: 'טפסים' },
  { href: '/results', label: 'תוצאות' },
  { href: '/stats', label: 'סטטיסטיקות' },
]

const ADMIN_USERS = ['ליכטטור']

function readUserName(): string {
  const stored = localStorage.getItem('user')
  return stored ? (JSON.parse(stored).label ?? '') : (localStorage.getItem('userName') ?? '')
}

export const USER_STORAGE_EVENT = 'userStorageUpdated'

export default function Nav() {
  const path = window.location.pathname
  const [userName, setUserName] = useState(readUserName)

  useEffect(() => {
    const handler = () => setUserName(readUserName())
    window.addEventListener(USER_STORAGE_EVENT, handler)
    return () => window.removeEventListener(USER_STORAGE_EVENT, handler)
  }, [])

  const links = ADMIN_USERS.includes(userName) ? ADMIN_LINKS : LINKS
  return (
    <nav className="site-nav" dir="rtl" aria-label="ניווט ראשי">
      {links.map(({ href, label }) => (
        <a
          key={href}
          href={href}
          className={`site-nav__link${path === href ? ' site-nav__link--active' : ''}`}
          aria-current={path === href ? 'page' : undefined}
        >
          {label}
        </a>
      ))}
    </nav>
  )
}

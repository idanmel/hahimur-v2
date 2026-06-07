export const USER_STORAGE_EVENT = 'userStorageUpdated'

const LINKS = [
  { href: '/', label: 'בית' },
  { href: '/forms', label: 'טפסים' },
  { href: '/results', label: 'תוצאות' },
  { href: '/stats', label: 'סטטיסטיקות' },
]

export default function Nav() {
  const path = window.location.pathname
  return (
    <nav className="site-nav" dir="rtl" aria-label="ניווט ראשי">
      {LINKS.map(({ href, label }) => (
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

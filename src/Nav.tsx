const LINKS = [
  { href: '/', label: 'בית' },
  { href: '/form', label: 'הטופס' },
]

const ADMIN_LINKS = [
  ...LINKS,
  { href: '/forms', label: 'טפסים' },
  { href: '/results', label: 'תוצאות' },
  { href: '/leaderboard', label: 'הטבלה' },
  { href: '/sim', label: 'סימולציה' },
  { href: '/stats', label: 'סטטיסטיקות' },
]

const ADMIN_USERS = ['ליכטטור']

export default function Nav() {
  const path = window.location.pathname
  const userName = localStorage.getItem('userName') ?? ''
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

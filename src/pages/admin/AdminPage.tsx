import { useState } from 'react'
import PageLayout from '../../shared/PageLayout'
import './AdminPage.css'

type Status = 'idle' | 'loading' | 'ok' | 'error' | 'unauthorized'

function toHebrewDate(date: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(date)
}

export default function AdminPage() {
  const [subject, setSubject] = useState(() => localStorage.getItem('admin_draft_subject') ?? '')
  const [text, setText] = useState(() => localStorage.getItem('admin_draft_text') ?? '')
  const [password, setPassword] = useState(() => localStorage.getItem('admin_password') ?? '')
  const [status, setStatus] = useState<Status>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    const date = toHebrewDate(new Date())
    try {
      const res = await fetch('/api/publish-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, text, date, password }),
      })
      if (res.status === 401) {
        localStorage.removeItem('admin_password')
        setStatus('unauthorized')
        return
      }
      if (!res.ok) {
        setStatus('error')
        return
      }
      localStorage.setItem('admin_password', password)
      localStorage.removeItem('admin_draft_subject')
      localStorage.removeItem('admin_draft_text')
      setStatus('ok')
      setSubject('')
      setText('')
    } catch {
      setStatus('error')
    }
  }

  return (
    <PageLayout title="ניהול">
      <div className="admin-wrapper">
        <div className="admin-panel">
          <div className="admin-panel__head">
            <h2 className="admin-panel__title">פרסום עדכון</h2>
            <span className="admin-panel__badge">ADMIN ONLY</span>
          </div>

          <form aria-label="פרסום עדכון" onSubmit={handleSubmit} className="admin-form">
            <div className="admin-field">
              <label htmlFor="subject" className="admin-label">נושא</label>
              <input
                id="subject"
                type="text"
                required
                value={subject}
                onChange={e => {
                  setSubject(e.target.value)
                  localStorage.setItem('admin_draft_subject', e.target.value)
                }}
                className="admin-input"
                placeholder="כותרת העדכון..."
              />
            </div>

            <div className="admin-field">
              <label htmlFor="text" className="admin-label">תוכן</label>
              <textarea
                id="text"
                rows={10}
                value={text}
                onChange={e => {
                  setText(e.target.value)
                  localStorage.setItem('admin_draft_text', e.target.value)
                }}
                className="admin-input"
                placeholder="כתוב את העדכון כאן..."
              />
            </div>

            <div className="admin-field admin-field--password">
              <label htmlFor="password" className="admin-label">סיסמה</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="admin-input"
                placeholder="••••••••"
              />
            </div>

            <hr className="admin-divider" />

            <div className="admin-footer">
              {status === 'ok' && (
                <span className="admin-status admin-status--ok">
                  <span className="admin-status__dot" />
                  פורסם בהצלחה
                </span>
              )}
              {status === 'unauthorized' && (
                <span className="admin-status admin-status--unauth">
                  <span className="admin-status__dot" />
                  סיסמה שגויה
                </span>
              )}
              {status === 'error' && (
                <span className="admin-status admin-status--error">
                  <span className="admin-status__dot" />
                  שגיאה בשמירה — נסה שוב
                </span>
              )}
              {(status === 'idle' || status === 'loading') && <span />}

              <button
                type="submit"
                disabled={status === 'loading'}
                className={`admin-submit${status === 'loading' ? ' admin-submit--loading' : ''}`}
              >
                {status === 'loading' ? 'שולח' : 'פרסם'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </PageLayout>
  )
}

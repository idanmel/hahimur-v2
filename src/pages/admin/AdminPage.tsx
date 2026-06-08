import { useState } from 'react'
import PageLayout from '../../shared/PageLayout'

type Status = 'idle' | 'loading' | 'ok' | 'error' | 'unauthorized'

function toHebrewDate(date: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(date)
}

export default function AdminPage() {
  const [subject, setSubject] = useState('')
  const [paragraphsRaw, setParagraphsRaw] = useState('')
  const [password, setPassword] = useState(() => localStorage.getItem('admin_password') ?? '')
  const [status, setStatus] = useState<Status>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('loading')
    const paragraphs = paragraphsRaw.split(/\n\n+/).map(p => p.trim()).filter(Boolean)
    const date = toHebrewDate(new Date())
    try {
      const res = await fetch('/api/publish-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, paragraphs, date, password }),
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
      setStatus('ok')
      setSubject('')
      setParagraphsRaw('')
    } catch {
      setStatus('error')
    }
  }

  return (
    <PageLayout title="ניהול">
      <main dir="rtl" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
        <form aria-label="פרסום עדכון" onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="subject">נושא</label>
            <input
              id="subject"
              type="text"
              required
              value={subject}
              onChange={e => setSubject(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: '0.25rem' }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="paragraphs">פסקאות</label>
            <textarea
              id="paragraphs"
              rows={10}
              value={paragraphsRaw}
              onChange={e => setParagraphsRaw(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: '0.25rem' }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="password">סיסמה</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: '0.25rem' }}
            />
          </div>

          <button type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? 'שולח...' : 'פרסם'}
          </button>

          {status === 'ok' && <p style={{ color: 'green', marginTop: '1rem' }}>פורסם בהצלחה!</p>}
          {status === 'unauthorized' && <p style={{ color: 'red', marginTop: '1rem' }}>סיסמה שגויה</p>}
          {status === 'error' && <p style={{ color: 'red', marginTop: '1rem' }}>שגיאה בשמירה. נסה שוב.</p>}
        </form>
      </main>
    </PageLayout>
  )
}

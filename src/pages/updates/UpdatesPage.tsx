import { useState, useEffect } from 'react'
import PageLayout from '../../shared/PageLayout'
import type { Update } from './updates'
import './UpdatesPage.css'

function formatText(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<u>$1</u>')
}

export default function UpdatesPage() {
  const [updates, setUpdates] = useState<Update[]>([])
  const [openIds, setOpenIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetch('/updates.json')
      .then(r => r.json())
      .then((data: Update[]) => {
        const visible = data.filter(u => !u.draft)
        setUpdates(visible)
        // Newest update (first in the list) stays expanded, as before.
        if (visible.length > 0) setOpenIds(new Set([visible[0].id]))
      })
  }, [])

  const toggle = (id: number) =>
    setOpenIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <PageLayout title="עדכונים">
      <main dir="rtl" className="updates-page">
        {updates.map((update, idx) => {
          const isNewest = idx === 0
          const isOpen = openIds.has(update.id)

          return (
            <article
              key={update.id}
              className={`update-card${isOpen ? '' : ' update-card--collapsed'}`}
              style={{ animationDelay: `${idx * 0.1 + 0.05}s` }}
            >
              <div className="update-card__meta">
                <span className="update-card__date">{update.date}</span>
                <span className="update-card__edition">גיליון {update.id}</span>
              </div>

              <div className="update-card__content">
                {isNewest ? (
                  <h2 className="update-card__subject">{update.subject}</h2>
                ) : (
                  <button
                    type="button"
                    className="update-card__subject update-card__subject--toggle"
                    aria-expanded={isOpen}
                    onClick={() => toggle(update.id)}
                  >
                    <span>{update.subject}</span>
                    <span className="update-card__chevron" aria-hidden="true">
                      {isOpen ? '▲' : '▼'}
                    </span>
                  </button>
                )}

                {isOpen && (
                  <>
                    <div className="update-card__body">
                      <p style={{ whiteSpace: 'pre-line' }} dangerouslySetInnerHTML={{ __html: formatText(update.text) }} />
                    </div>

                    {update.pdfFilename && (
                      <div className="update-card__pdf-section">
                        <div className="update-card__pdf-header">
                          <span className="update-card__pdf-icon">📎</span>
                          <span className="update-card__pdf-label">
                            {update.pdfLabel ?? update.pdfFilename}
                          </span>
                        </div>
                        <iframe
                          src={`/${update.pdfFilename}`}
                          title={update.pdfLabel ?? update.pdfFilename}
                          className="update-card__pdf-frame"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </article>
          )
        })}
      </main>
    </PageLayout>
  )
}

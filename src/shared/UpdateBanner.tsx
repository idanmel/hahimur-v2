interface Props {
  updateAvailable: boolean
}

export default function UpdateBanner({ updateAvailable }: Props) {
  if (!updateAvailable) return null

  return (
    <div role="alert" className="update-banner">
      <span className="update-banner__dot" aria-hidden>↻</span>
      <div className="update-banner__copy">
        <span className="update-banner__headline">גרסה חדשה זמינה</span>
        <span className="update-banner__sub">יש עדכון לאתר</span>
      </div>
      <button className="update-banner__btn" onClick={() => window.location.reload()}>
        רענן
      </button>
    </div>
  )
}

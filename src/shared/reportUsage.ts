// Fire-and-forget usage signal. Every tracked button reports through here to the
// single /api/click endpoint, tagged with a `feature` and `who` (the participant
// the viewer identified as, or '' when anonymous). localhost clicks are dev noise
// and never reach the counter; a failed report must never break the caller, so
// errors are swallowed.
export function reportUsage(feature: string, who = '') {
  if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    fetch('/api/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature, who }),
    }).catch(() => {})
  }
}

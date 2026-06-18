// Fire-and-forget usage signal. localhost clicks are dev noise and never reach
// the counter; a failed report must never break the caller, so errors are swallowed.
export function reportUsage(endpoint: string) {
  if (!['localhost', '127.0.0.1'].includes(window.location.hostname)) {
    fetch(endpoint, { method: 'POST' }).catch(() => {})
  }
}

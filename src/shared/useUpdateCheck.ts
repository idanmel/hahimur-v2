import { useState, useEffect } from 'react'

const ASSET_SCRIPT_SELECTOR = 'script[type="module"][src*="/assets/"]'
const ASSET_SRC_PATTERN = /src="(\/assets\/index-[^"]+\.js)"/

function getCurrentHash(): string | null {
  return document.querySelector(ASSET_SCRIPT_SELECTOR)?.getAttribute('src') ?? null
}

function extractHash(html: string): string | null {
  return html.match(ASSET_SRC_PATTERN)?.[1] ?? null
}

export function useUpdateCheck(intervalMs: number) {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    const currentHash = getCurrentHash()
    if (!currentHash) return

    const check = async () => {
      const html = await fetch('/index.html').then(r => r.text())
      const fetchedHash = extractHash(html)
      if (fetchedHash && fetchedHash !== currentHash) {
        setUpdateAvailable(true)
      }
    }

    const id = setInterval(check, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return { updateAvailable }
}

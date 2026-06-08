import type { VercelRequest, VercelResponse } from '@vercel/node'

const REPO = 'idanmel/hahimur-v2'
const FILE_PATH = 'public/updates.json'
const GITHUB_API = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`

interface Update {
  id: number
  date: string
  subject: string
  paragraphs: string[]
  draft?: boolean
  pdfFilename?: string
  pdfLabel?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { password, subject, paragraphs, date } = req.body as {
    password: string
    subject: string
    paragraphs: string[]
    date: string
  }

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const token = process.env.GITHUB_TOKEN
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  }

  const getRes = await fetch(GITHUB_API, { headers })
  if (!getRes.ok) {
    const err = await getRes.json()
    return res.status(getRes.status).json(err)
  }
  const { content, sha } = await getRes.json() as { content: string; sha: string }

  const updates: Update[] = JSON.parse(Buffer.from(content, 'base64').toString('utf-8'))
  const maxId = updates.length > 0 ? Math.max(...updates.map(u => u.id)) : 0
  const newEntry: Update = { id: maxId + 1, date, subject, paragraphs }
  const newContent = JSON.stringify([newEntry, ...updates], null, 2)
  const encoded = Buffer.from(newContent, 'utf-8').toString('base64')

  const putRes = await fetch(GITHUB_API, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `admin: add update #${newEntry.id}`,
      content: encoded,
      sha,
    }),
  })

  if (!putRes.ok) {
    const err = await putRes.json()
    return res.status(putRes.status).json(err)
  }

  return res.status(200).json({ ok: true })
}

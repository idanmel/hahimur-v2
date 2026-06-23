import { neon } from '@neondatabase/serverless'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { feature, who } = (req.body ?? {}) as { feature?: string; who?: string }
  if (!feature) {
    return res.status(400).json({ error: 'feature is required' })
  }

  const sql = neon(process.env.DATABASE_URL!)
  // `who` is the participant the viewer identified as; null when anonymous.
  await sql`INSERT INTO clicks (feature, who) VALUES (${feature}, ${who || null})`

  return res.status(200).json({ ok: true })
}

import { neon } from '@neondatabase/serverless'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const sql = neon(process.env.DATABASE_URL!)
  await sql`INSERT INTO sim_clicks DEFAULT VALUES`

  return res.status(200).json({ ok: true })
}

import { db, readBody, today } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

// POST { bin_id, bin_name, cards, start, end, ms }  (start/end = epoch ms)
export default async function handler(req, res) {
  const who = requireAuth(req);
  if (!who) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  try {
    const { bin_id, bin_name, cards, start, end, ms, username } = readBody(req);
    const picker = username || who.sub;   // assigned picker (for split groups); falls back to the caller
    const sql = db();
    const day = today();
    await sql`INSERT INTO bin_completions (bin_id, day, username, completed_at)
              VALUES (${bin_id}, ${day}, ${picker}, now())
              ON CONFLICT (bin_id, day) DO UPDATE SET username = ${picker}, completed_at = now()`;
    if (start && end) {
      await sql`INSERT INTO pick_sessions (bin_id, bin_name, username, cards, start_ts, end_ts, ms, day)
                VALUES (${bin_id}, ${bin_name || ''}, ${picker}, ${cards ?? 0},
                        to_timestamp(${start} / 1000.0), to_timestamp(${end} / 1000.0), ${ms ?? 0}, ${day})`;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

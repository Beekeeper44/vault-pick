import { db, readBody } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

// POST { bin_ids: number[] | number, username: string | null }
// username null → unassign. Supports one bin or a whole group/split in one call.
export default async function handler(req, res) {
  const who = requireAuth(req);
  if (!who || who.role !== 'admin') { res.status(403).json({ error: 'Admin only' }); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  try {
    const { bin_ids, username } = readBody(req);
    const ids = Array.isArray(bin_ids) ? bin_ids : [bin_ids];
    const sql = db();
    for (const bid of ids) {
      if (bid == null) continue;
      if (username) {
        await sql`INSERT INTO assignments (bin_id, username, updated_at) VALUES (${bid}, ${username}, now())
                  ON CONFLICT (bin_id) DO UPDATE SET username = ${username}, updated_at = now()`;
      } else {
        await sql`DELETE FROM assignments WHERE bin_id = ${bid}`;
      }
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

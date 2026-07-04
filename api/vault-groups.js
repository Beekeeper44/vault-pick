import { db, readBody } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

// POST   { lo, hi }      → add a vault group (admin)
// DELETE ?lo=&hi=         → remove the matching range (admin)
export default async function handler(req, res) {
  const who = requireAuth(req);
  if (!who || who.role !== 'admin') { res.status(403).json({ error: 'Admin only' }); return; }
  const sql = db();
  try {
    if (req.method === 'POST') {
      const { lo, hi } = readBody(req);
      if (!Number.isInteger(lo) || !Number.isInteger(hi) || hi <= lo) { res.status(400).json({ error: 'Invalid range' }); return; }
      await sql`INSERT INTO vault_groups (lo, hi) VALUES (${lo}, ${hi})`;
      res.status(200).json({ ok: true }); return;
    }
    if (req.method === 'DELETE') {
      const lo = parseInt(req.query.lo, 10), hi = parseInt(req.query.hi, 10);
      await sql`DELETE FROM vault_groups WHERE lo = ${lo} AND hi = ${hi}`;
      res.status(200).json({ ok: true }); return;
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

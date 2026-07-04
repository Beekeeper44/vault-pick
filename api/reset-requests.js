import { db, readBody } from '../lib/db.js';
import { requireAuth, hashPassword } from '../lib/auth.js';

// POST  { username, note }               → create a request (no auth; from login screen)
// GET                                    → list pending (admin)
// PATCH { id, status, newPassword? }      → resolve/dismiss (admin); if resolving with a
//                                           newPassword, the user's password is updated.
export default async function handler(req, res) {
  const sql = db();
  try {
    if (req.method === 'POST') {
      const { username, note } = readBody(req);
      const u = String(username || '').toLowerCase().trim();
      if (!u) { res.status(400).json({ error: 'username required' }); return; }
      const exists = await sql`SELECT 1 FROM users WHERE username = ${u}`;
      if (!exists.length) { res.status(404).json({ error: 'No such user' }); return; }
      const dup = await sql`SELECT 1 FROM reset_requests WHERE username = ${u} AND status = 'pending'`;
      if (dup.length) { res.status(200).json({ ok: true, duplicate: true }); return; }
      await sql`INSERT INTO reset_requests (username, note) VALUES (${u}, ${note || ''})`;
      res.status(200).json({ ok: true }); return;
    }

    const who = requireAuth(req);
    if (!who || who.role !== 'admin') { res.status(403).json({ error: 'Admin only' }); return; }

    if (req.method === 'GET') {
      const rows = await sql`SELECT id, username, note, status, (extract(epoch FROM created_at)*1000)::bigint AS ts
                             FROM reset_requests WHERE status = 'pending' ORDER BY created_at DESC`;
      res.status(200).json(rows); return;
    }
    if (req.method === 'PATCH') {
      const { id, status, newPassword } = readBody(req);
      const rows = await sql`SELECT username FROM reset_requests WHERE id = ${id}`;
      if (!rows.length) { res.status(404).json({ error: 'Request not found' }); return; }
      if (status === 'resolved' && newPassword) {
        await sql`UPDATE users SET password_hash = ${hashPassword(newPassword)} WHERE username = ${rows[0].username}`;
      }
      await sql`UPDATE reset_requests SET status = ${status || 'resolved'}, resolved_at = now() WHERE id = ${id}`;
      res.status(200).json({ ok: true }); return;
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

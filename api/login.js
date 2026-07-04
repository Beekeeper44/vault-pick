import { db, readBody } from '../lib/db.js';
import { verifyPassword, signToken } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  try {
    const { username, password } = readBody(req);
    const sql = db();
    const rows = await sql`SELECT username, name, role, password_hash FROM users WHERE username = ${String(username || '').toLowerCase()}`;
    const u = rows[0];
    if (!u || !verifyPassword(password, u.password_hash)) {
      res.status(401).json({ ok: false, error: 'Invalid username or password' });
      return;
    }
    const token = signToken({ sub: u.username, role: u.role });
    res.status(200).json({ ok: true, token, user: { username: u.username, name: u.name, role: u.role } });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

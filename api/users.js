import { db, readBody } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { hashPassword } from '../lib/auth.js';

// GET                       → list users (no hashes)
// POST   { username, name, role, password }   → create
// PATCH  { username, role?, password? }        → update role and/or password
// DELETE ?username=...       → remove
// All writes require an admin token. Guards keep at least one admin.
export default async function handler(req, res) {
  const who = requireAuth(req);
  if (!who) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const sql = db();
  try {
    if (req.method === 'GET') {
      const rows = await sql`SELECT username, name, role FROM users ORDER BY username`;
      res.status(200).json(rows); return;
    }
    if (who.role !== 'admin') { res.status(403).json({ error: 'Admin only' }); return; }

    if (req.method === 'POST') {
      const { username, name, role, password } = readBody(req);
      const u = String(username || '').toLowerCase().trim();
      if (!u || !password) { res.status(400).json({ error: 'username and password required' }); return; }
      const exists = await sql`SELECT 1 FROM users WHERE username = ${u}`;
      if (exists.length) { res.status(409).json({ error: 'That username already exists' }); return; }
      await sql`INSERT INTO users (username, name, role, password_hash)
                VALUES (${u}, ${name || u}, ${role === 'admin' ? 'admin' : 'employee'}, ${hashPassword(password)})`;
      res.status(200).json({ ok: true }); return;
    }

    if (req.method === 'PATCH') {
      const { username, role, password } = readBody(req);
      const u = String(username || '').toLowerCase();
      if (role) {
        if (role !== 'admin') {
          const admins = await sql`SELECT count(*)::int AS n FROM users WHERE role = 'admin'`;
          const isAdmin = await sql`SELECT 1 FROM users WHERE username = ${u} AND role = 'admin'`;
          if (isAdmin.length && admins[0].n <= 1) { res.status(400).json({ error: 'Keep at least one admin' }); return; }
        }
        await sql`UPDATE users SET role = ${role === 'admin' ? 'admin' : 'employee'} WHERE username = ${u}`;
      }
      if (password) await sql`UPDATE users SET password_hash = ${hashPassword(password)} WHERE username = ${u}`;
      res.status(200).json({ ok: true }); return;
    }

    if (req.method === 'DELETE') {
      const u = String(req.query.username || '').toLowerCase();
      const isAdmin = await sql`SELECT 1 FROM users WHERE username = ${u} AND role = 'admin'`;
      if (isAdmin.length) {
        const admins = await sql`SELECT count(*)::int AS n FROM users WHERE role = 'admin'`;
        if (admins[0].n <= 1) { res.status(400).json({ error: 'Keep at least one admin' }); return; }
      }
      await sql`DELETE FROM users WHERE username = ${u}`;
      res.status(200).json({ ok: true }); return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

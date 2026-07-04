import { db, today } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

// One call the app makes right after login to hydrate all state from the DB.
export default async function handler(req, res) {
  const who = requireAuth(req);
  if (!who) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const sql = db();
    const day = today();
    const users   = await sql`SELECT username, name, role FROM users ORDER BY username`;
    const groups  = await sql`SELECT lo, hi FROM vault_groups ORDER BY lo`;
    const assigns = await sql`SELECT bin_id, username FROM assignments WHERE username IS NOT NULL`;
    const picks   = await sql`SELECT card_id, bin_id, state, username FROM pick_state`;
    const comps   = await sql`SELECT bin_id, to_char(day,'YYYY-MM-DD') AS day, username FROM bin_completions WHERE day = ${day}`;
    const reqs    = await sql`SELECT id, username, note, status, (extract(epoch FROM created_at)*1000)::bigint AS ts FROM reset_requests WHERE status = 'pending' ORDER BY created_at DESC`;
    const sessions= await sql`SELECT bin_id, bin_name, username, cards,
                                (extract(epoch FROM start_ts)*1000)::bigint AS start_ms,
                                (extract(epoch FROM end_ts)*1000)::bigint AS end_ms,
                                ms, to_char(day,'YYYY-MM-DD') AS day
                              FROM pick_sessions ORDER BY end_ts DESC LIMIT 300`;
    const history = await sql`SELECT (extract(epoch FROM ts)*1000)::bigint AS ts, to_char(day,'YYYY-MM-DD') AS day,
                                username, action, url, bin_id, bin_name, slot, order_number,
                                player_name, card_status, ac, in_process_days
                              FROM activity_log ORDER BY ts DESC LIMIT 1000`;
    res.status(200).json({
      vaultGroups: groups.map(g => [g.lo, g.hi]),
      users, assignments: assigns, pickState: picks,
      completions: comps, resetRequests: reqs, sessions, history,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

import { db, readBody, today } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

// POST { card_id, bin_id, state: 'picked'|'flagged'|null, card: {...} }
// state null → clear the card's pick state (reset).
export default async function handler(req, res) {
  const who = requireAuth(req);
  if (!who) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  try {
    const { card_id, bin_id, state, card = {} } = readBody(req);
    const sql = db();
    if (state == null) {
      await sql`DELETE FROM pick_state WHERE card_id = ${String(card_id)}`;
    } else {
      await sql`INSERT INTO pick_state (card_id, bin_id, state, username, updated_at)
                VALUES (${String(card_id)}, ${bin_id ?? null}, ${state}, ${who.sub}, now())
                ON CONFLICT (card_id) DO UPDATE SET state = ${state}, username = ${who.sub}, updated_at = now()`;
      await sql`INSERT INTO activity_log
                (ts, day, username, action, url, bin_id, bin_name, slot, order_number, player_name, card_status, ac, in_process_days)
                VALUES (now(), ${today()}, ${who.sub}, ${state}, ${card.url || ''}, ${bin_id ?? null},
                        ${card.bin_name || ''}, ${card.slot ?? null}, ${card.order_number || ''}, ${card.player_name || ''},
                        ${card.card_status || ''}, ${card.ac || ''}, ${card.in_process_days ?? null})`;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}

// Vercel serverless function — proxies Arena Club Metabase question #2695 ("picking").
// Deploy this file at /api/picking.js alongside index.html (the Vault Pick app).
// The front-end calls  /api/picking?bin_min=&bin_max=&min_in_process_days=&search=
// and expects a JSON array of row objects (the picking columns).
//
// Why a proxy? The Metabase API key must NEVER live in the browser. This function
// runs server-side on Vercel, holds the key in an env var, and returns only the rows.
//
// ── Required Vercel env vars (Project → Settings → Environment Variables) ──
//   METABASE_URL      e.g.  https://arena-club.metabaseapp.com   (no trailing slash needed)
//   METABASE_API_KEY  a Metabase API key  (Admin → Settings → Authentication → API keys)
//
// If your Metabase is old enough that it lacks API keys, swap the header for a
// session token: log in via POST /api/session to get an id, then send
//   headers: { 'X-Metabase-Session': token }
// instead of x-api-key.

const CARD_ID = 2695; // the "picking" question

export default async function handler(req, res) {
  const base = (process.env.METABASE_URL || process.env.METABASE_HOST || '').replace(/\/+$/, '');
  const key  = process.env.METABASE_API_KEY;
  if (!base || !key) {
    res.status(500).json({ error: 'Missing METABASE_URL (or METABASE_HOST) or METABASE_API_KEY environment variables' });
    return;
  }

  const { bin_min, bin_max, min_in_process_days, search } = req.query;

  // Map the query params to Metabase native-question parameters (template tags).
  // IMPORTANT: the `type` values below must match how each variable is defined in
  // question 2695. Numbers use 'number/=', a text search box uses 'category'.
  // If a value is blank we omit it so Metabase uses the query's default.
  const parameters = [];
  const addNum = (slug, v) => { if (v !== undefined && v !== '') parameters.push({ type: 'number/=', target: ['variable', ['template-tag', slug]], value: Number(v) }); };
  const addTxt = (slug, v) => { if (v !== undefined && v !== '') parameters.push({ type: 'category',  target: ['variable', ['template-tag', slug]], value: String(v) }); };
  addNum('bin_min', bin_min);
  addNum('bin_max', bin_max);
  addNum('min_in_process_days', min_in_process_days);
  addTxt('search', search);

  try {
    const r = await fetch(`${base}/api/card/${CARD_ID}/query/json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({ parameters }),
    });

    if (!r.ok) {
      const detail = (await r.text()).slice(0, 800);
      res.status(r.status).json({ error: 'Metabase query failed', status: r.status, detail });
      return;
    }

    const rows = await r.json(); // /query/json returns an array of row objects
    // Cache at the edge briefly to spare Metabase during busy picking windows.
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    res.status(200).json(rows);
  } catch (e) {
    res.status(502).json({ error: 'Proxy request failed', detail: String(e) });
  }
}

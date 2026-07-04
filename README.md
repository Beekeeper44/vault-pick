# Vault Pick

Arena Club warehouse card-picking app.

- **Front-end:** `index.html` (single file — Pick / History / Tracker / Admin).
- **Reads:** Metabase question **#2695** ("picking") via `api/picking.js`.
- **Storage:** **Neon Postgres** (users + hashed passwords, assignments, pick/flag state,
  bin completions, tracker sessions, activity log, reset requests) via the `api/*` endpoints.

The app runs on built-in sample data if the backend isn't reachable, so it always works.
When `DATABASE_URL` (Neon) and the Metabase vars are set on Vercel, it logs in against the
DB, hydrates real state, and persists every write.

```
vault-pick/
├─ index.html            # the app
├─ api/
│  ├─ picking.js         # Metabase proxy (reads question 2695)
│  ├─ login.js           # verify hashed password → session token
│  ├─ bootstrap.js       # hydrate all state after login
│  ├─ assign.js          # set/clear bin assignees
│  ├─ pick.js            # picked/flagged + activity log
│  ├─ complete.js        # bin completion + tracker session
│  ├─ users.js           # create/update/delete users
│  ├─ reset-requests.js  # password-reset request queue
│  └─ vault-groups.js    # add/remove bin ranges
├─ lib/
│  ├─ db.js              # Neon client
│  └─ auth.js            # scrypt hashing + signed tokens
├─ db/schema.sql          # tables
├─ scripts/seed.js        # create schema + seed users/groups
├─ package.json  vercel.json  .env.example  .gitignore
```

## 1. Neon database
1. Create a project at neon.tech and copy the **pooled** connection string
   (host contains `-pooler`, keep `?sslmode=require`).
2. Locally: `cp .env.example .env.local` and fill in `DATABASE_URL` and `SESSION_SECRET`.
3. Create the schema and seed default users + vault groups:
   ```bash
   npm install
   npm run seed
   ```
   Default logins: `alan/arena` (admin), `manny/pick`, `arman/pick` (admins),
   `jordan/pick`, `austin/pick`, `jesse/pick` (employees). Passwords are stored **scrypt-hashed**.

## 2. Metabase
- `METABASE_URL` = `https://arena-club.metabaseapp.com`
- `METABASE_API_KEY` = Admin → Settings → Authentication → **API keys**

## 3. Deploy: GitHub → Vercel
```bash
git init && git add . && git commit -m "Vault Pick" && git branch -M main
git remote add origin https://github.com/<you>/vault-pick.git && git push -u origin main
```
Import the repo in Vercel (framework preset **Other** — no build step). Then add the env
vars for all environments and redeploy:

| Name | Value |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `SESSION_SECRET` | long random string |
| `METABASE_URL` | `https://arena-club.metabaseapp.com` |
| `METABASE_API_KEY` | your Metabase API key |

On login the header subtitle shows `… · Neon storage` when the DB is connected, and
`… · live · Metabase #2695` once picking rows load. If either backend is unreachable the
app quietly falls back to sample data (reasons logged to the browser console).

## Local dev
```bash
npm i -g vercel
vercel dev     # serves index.html + all /api endpoints with .env.local
```

## Security notes
- Passwords are scrypt-hashed; login returns a short-lived HMAC-signed token
  (`SESSION_SECRET`) that the app sends as `Authorization: Bearer` on writes.
- Write endpoints check the token; admin-only actions (users, assignments, vault groups,
  resolving reset requests) require an admin token.
- The role-based hiding in the UI (employees see only their bins + the Pick tab) is
  convenience; the server enforces the real gate. For bin-level read scoping on the
  employee side, filter `/api/bootstrap` (or add a dedicated endpoint) by `who.sub`.

## Wiring to the real Metabase question
Confirm against question 2695 (both noted in code):
1. **Columns** — `index.html` → `mapRow()` maps `url, label_qr, card_status, order_number,
   bin_id, bin_name, slot, player_name, ac (8AC), in_process_days`.
2. **Pickable statuses + params** — `PICKABLE` in `index.html`, and the parameter
   `type`/slug in `api/picking.js` (`bin_min, bin_max, min_in_process_days, search`).

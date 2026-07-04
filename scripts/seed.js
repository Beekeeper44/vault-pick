// One-time seed: creates the schema and inserts default users (hashed) + vault groups.
// Usage:  cp .env.example .env.local  (fill in DATABASE_URL)  then:  npm run seed
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { neon } from '@neondatabase/serverless';
import { hashPassword } from '../lib/auth.js';

// tiny .env.local loader (no dependency)
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, '..', '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set (put it in .env.local)'); process.exit(1); }
const sql = neon(process.env.DATABASE_URL);

// default accounts — [username, name, role, password]
const USERS = [
  // Admins
  ['alan',   'Alan B.',  'admin',    'baller41980'],
  ['arman',  'Arman A.', 'admin',    'swift207'],
  ['manny',  'Manny S.', 'admin',    'orbit884'],
  // Employees
  ['aida',    'Aida S.',    'employee', 'maple613'],
  ['callie',  'Callie K.',  'employee', 'river772'],
  ['daniel',  'Daniel B.',  'employee', 'delta195'],
  ['davis',   'Davis U.',   'employee', 'cedar340'],
  ['donovan', 'Donovan C.', 'employee', 'nova8827'],
  ['isaiah',  'Isaiah B.',  'employee', 'atlas506'],
  ['joe',     'Joe C.',     'employee', 'flint914'],
  ['joey',    'Joey A.',    'employee', 'brisk338'],
  ['oscar',   'Oscar P.',   'employee', 'opal7725'],
  ['ricky',   'Ricky B.',   'employee', 'spark620'],
  ['steven',  'Steven R.',  'employee', 'quill487'],
  ['trevor',  'Trevor H.',  'employee', 'grove751'],
];

// vault groups: 701–2080 (as configured) then 240-wide up to 8000
function groups() {
  const g = [[701,940],[941,1180],[1181,1420],[1421,1660],[1661,1840],[1841,2080]];
  for (let lo = 2081; lo <= 8000; lo += 240) g.push([lo, Math.min(lo + 239, 8000)]);
  return g;
}

async function run() {
  // schema
  const ddl = readFileSync(join(__dir, '..', 'db', 'schema.sql'), 'utf8');
  for (const stmt of ddl.split(';').map(s => s.trim()).filter(Boolean)) {
    await sql.query(stmt);
  }
  console.log('✓ schema ready');

  // users (upsert; only sets password if the row is new so re-seeding won't clobber changes)
  for (const [u, name, role, pw] of USERS) {
    await sql`INSERT INTO users (username, name, role, password_hash)
              VALUES (${u}, ${name}, ${role}, ${hashPassword(pw)})
              ON CONFLICT (username) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role`;
  }
  console.log(`✓ ${USERS.length} users`);

  // vault groups (only if empty, so we don't duplicate on re-run)
  const existing = await sql`SELECT count(*)::int AS n FROM vault_groups`;
  if (existing[0].n === 0) {
    for (const [lo, hi] of groups()) await sql`INSERT INTO vault_groups (lo, hi) VALUES (${lo}, ${hi})`;
    console.log('✓ vault groups seeded');
  } else {
    console.log('• vault groups already present, left as-is');
  }

  console.log('\nDone. Default logins → alan/arena (admin), jordan/pick (employee), etc.');
}

run().catch(e => { console.error(e); process.exit(1); });

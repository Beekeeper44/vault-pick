// Password hashing + lightweight signed session tokens — all with Node's built-in
// crypto (no native deps, works on Vercel's Node runtime).
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'crypto';

// ---- password hashing (scrypt) ----
export function hashPassword(pw) {
  const salt = randomBytes(16);
  const dk = scryptSync(String(pw), salt, 64);
  return `scrypt$${salt.toString('hex')}$${dk.toString('hex')}`;
}
export function verifyPassword(pw, stored) {
  try {
    const [scheme, saltHex, hashHex] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const dk = scryptSync(String(pw), Buffer.from(saltHex, 'hex'), 64);
    return timingSafeEqual(dk, Buffer.from(hashHex, 'hex'));
  } catch { return false; }
}

// ---- signed session tokens (HMAC) ----
const secret = () => process.env.SESSION_SECRET || 'dev-insecure-change-me';
export function signToken(payload, ttlSec = 60 * 60 * 24 * 30) {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec };
  const b64 = Buffer.from(JSON.stringify(body)).toString('base64url');
  const sig = createHmac('sha256', secret()).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}
export function verifyToken(token) {
  try {
    const [b64, sig] = String(token).split('.');
    const expect = createHmac('sha256', secret()).update(b64).digest('base64url');
    if (sig !== expect) return null;
    const body = JSON.parse(Buffer.from(b64, 'base64url').toString());
    if (body.exp && body.exp < Math.floor(Date.now() / 1000)) return null;
    return body; // { sub, role, exp }
  } catch { return null; }
}
export function bearer(req) {
  const h = req.headers['authorization'] || req.headers['Authorization'] || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}
export function requireAuth(req) { return verifyToken(bearer(req)); }

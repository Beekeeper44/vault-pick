// Neon (Postgres) client for Vercel serverless functions.
// Uses the HTTP driver — one round-trip per query, perfect for serverless.
import { neon } from '@neondatabase/serverless';

export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  return neon(url);
}

// Vercel parses JSON bodies automatically, but be defensive.
export function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  return {};
}

export function today() { return new Date().toISOString().slice(0, 10); }

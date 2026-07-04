-- Vault Pick — Neon/Postgres schema. Idempotent (safe to re-run).

CREATE TABLE IF NOT EXISTS users (
  username      text PRIMARY KEY,
  name          text NOT NULL DEFAULT '',
  role          text NOT NULL DEFAULT 'employee' CHECK (role IN ('admin','employee')),
  password_hash text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vault_groups (
  id  serial PRIMARY KEY,
  lo  integer NOT NULL,
  hi  integer NOT NULL
);

CREATE TABLE IF NOT EXISTS assignments (
  bin_id     integer PRIMARY KEY,
  username   text REFERENCES users(username) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pick_state (
  card_id    text PRIMARY KEY,
  bin_id     integer,
  state      text NOT NULL CHECK (state IN ('picked','flagged')),
  username   text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bin_completions (
  bin_id       integer NOT NULL,
  day          date NOT NULL,
  username     text,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bin_id, day)
);

CREATE TABLE IF NOT EXISTS pick_sessions (
  id        serial PRIMARY KEY,
  bin_id    integer,
  bin_name  text,
  username  text,
  cards     integer,
  start_ts  timestamptz,
  end_ts    timestamptz,
  ms        bigint,
  day       date
);

CREATE TABLE IF NOT EXISTS reset_requests (
  id          serial PRIMARY KEY,
  username    text,
  note        text,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','dismissed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS activity_log (
  id              serial PRIMARY KEY,
  ts              timestamptz NOT NULL DEFAULT now(),
  day             date NOT NULL,
  username        text,
  action          text,
  url             text,
  bin_id          integer,
  bin_name        text,
  slot            integer,
  order_number    text,
  player_name     text,
  card_status     text,
  ac              text,
  in_process_days integer
);
CREATE INDEX IF NOT EXISTS activity_log_day_idx ON activity_log (day);
CREATE INDEX IF NOT EXISTS activity_log_action_idx ON activity_log (action);

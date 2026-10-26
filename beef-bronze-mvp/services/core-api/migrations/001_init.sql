-- BEEF core schema, Bronze. Entities follow Spec 03 "Core entities".
-- Phone numbers are stored only as keyed HMAC hashes (never plaintext).

CREATE TABLE users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_hash   text NOT NULL UNIQUE,
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned', 'deleted')),
  tier         text NOT NULL DEFAULT 'V0' CHECK (tier IN ('V0', 'V1', 'V2', 'V3')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
  user_id      uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  bio          text NOT NULL DEFAULT '',
  birth_date   date NOT NULL,
  intents      text[] NOT NULL,
  vibe_tags    text[] NOT NULL DEFAULT '{}',
  games        text[] NOT NULL DEFAULT '{}',
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE swipes (
  swiper_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction    text NOT NULL CHECK (direction IN ('left', 'right')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (swiper_id, target_id),
  CHECK (swiper_id <> target_id)
);
CREATE INDEX swipes_target_right ON swipes (target_id) WHERE direction = 'right';

CREATE TABLE threads (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         text NOT NULL CHECK (kind IN ('direct', 'group', 'event')),
  -- For direct threads: the two member ids sorted and joined, so a pair can only ever have one thread.
  pair_key     text UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE thread_members (
  thread_id    uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);
CREATE INDEX thread_members_user ON thread_members (user_id);

CREATE TABLE game_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id       text NOT NULL,
  rules_version int NOT NULL,
  seed          bigint NOT NULL,
  players       uuid[] NOT NULL,
  source        text NOT NULL CHECK (source IN ('challenge', 'queue')),
  state         text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'finished', 'void')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  ended_at      timestamptz
);
CREATE INDEX game_sessions_players ON game_sessions USING gin (players);

CREATE TABLE challenges (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id      text NOT NULL,
  state        text NOT NULL DEFAULT 'sent' CHECK (state IN ('sent', 'accepted', 'declined', 'expired', 'cancelled')),
  session_id   uuid REFERENCES game_sessions(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '72 hours'
);
CREATE INDEX challenges_to_open ON challenges (to_user) WHERE state = 'sent';

CREATE TABLE results (
  session_id    uuid PRIMARY KEY REFERENCES game_sessions(id),
  winner_id     uuid REFERENCES users(id),
  draw          boolean NOT NULL,
  move_count    int NOT NULL,
  verification  text NOT NULL CHECK (verification IN ('server', 'mutual', 'capture', 'venue', 'player')),
  strength      numeric(3,2) NOT NULL,
  verified_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ratings (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id      text NOT NULL,
  format       text NOT NULL DEFAULT '1v1',
  rating       double precision NOT NULL DEFAULT 1500,
  rd           double precision NOT NULL DEFAULT 350,
  vol          double precision NOT NULL DEFAULT 0.06,
  games        int NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_id, format)
);

-- Append-only ledger. Balances are sums; nothing is ever updated in place.
CREATE TABLE ledger (
  id           bigserial PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency     text NOT NULL CHECK (currency IN ('XP', 'BP')),
  delta        int NOT NULL,
  reason       text NOT NULL,
  -- level group the entry counts toward for daily caps: 'l12', 'l3', 'l4', or 'other'
  cap_group    text NOT NULL DEFAULT 'other',
  ref_id       text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, currency, reason, ref_id)
);
CREATE INDEX ledger_user_day ON ledger (user_id, currency, cap_group, created_at);

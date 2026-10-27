-- Silver social layer: follows, blocks, result posts, reactions, comments.

CREATE TABLE follows (
  follower    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower, followee),
  CHECK (follower <> followee)
);
CREATE INDEX follows_followee ON follows (followee);

-- A block is one-directional to create but hides both people from each other everywhere:
-- feed, deck, challenges, follows, comments and chat.
CREATE TABLE blocks (
  blocker     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker, blocked),
  CHECK (blocker <> blocked)
);
CREATE INDEX blocks_blocked ON blocks (blocked);

CREATE TABLE posts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        text NOT NULL CHECK (kind IN ('result')),
  session_id  uuid UNIQUE REFERENCES game_sessions(id),
  game_id     text NOT NULL,
  players     uuid[] NOT NULL,
  payload     jsonb NOT NULL,
  -- Set by moderators (or when a player hides their own result).
  hidden      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX posts_players ON posts USING gin (players);
CREATE INDEX posts_recent ON posts (created_at DESC, id DESC);

CREATE TABLE reactions (
  post_id     uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('fire', 'skull', 'clap', 'beef', 'laugh')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        text NOT NULL CHECK (length(body) BETWEEN 1 AND 500),
  action      text NOT NULL CHECK (action IN ('allow', 'blur')),
  labels      text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
CREATE INDEX comments_post ON comments (post_id, created_at);

-- Rematches link back to the game they continue.
ALTER TABLE challenges ADD COLUMN rematch_of uuid REFERENCES game_sessions(id);

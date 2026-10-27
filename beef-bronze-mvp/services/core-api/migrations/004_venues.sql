-- Silver Level 4: partner venues, slots, bookings, staff check-in and attested results,
-- plus the in-person safety layer from Spec 04. No money moves anywhere in this flow.

ALTER TABLE game_sessions DROP CONSTRAINT game_sessions_source_check;
ALTER TABLE game_sessions ADD CONSTRAINT game_sessions_source_check CHECK (source IN ('challenge', 'queue', 'venue'));

CREATE TABLE venues (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  address        text NOT NULL,
  city           text NOT NULL,
  lat            double precision NOT NULL,
  lng            double precision NOT NULL,
  timezone       text NOT NULL DEFAULT 'America/Chicago',
  games          text[] NOT NULL,
  -- Spec 05: staff trained, cameras, quarterly audit. A pair's first two meets must be at one.
  safe_certified boolean NOT NULL DEFAULT false,
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE venue_staff (
  venue_id   uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('owner', 'staff')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (venue_id, user_id)
);

CREATE TABLE venue_slots (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id   uuid NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  game_id    text NOT NULL,
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz NOT NULL,
  -- Tables, lanes or boards available for this window.
  capacity   int NOT NULL CHECK (capacity BETWEEN 1 AND 50),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX venue_slots_upcoming ON venue_slots (venue_id, starts_at);

CREATE TABLE bookings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id       uuid NOT NULL REFERENCES venue_slots(id),
  host_id       uuid NOT NULL REFERENCES users(id),
  guest_id      uuid NOT NULL REFERENCES users(id),
  state         text NOT NULL DEFAULT 'invited'
                CHECK (state IN ('invited', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show')),
  host_checked_in_at  timestamptz,
  guest_checked_in_at timestamptz,
  session_id    uuid REFERENCES game_sessions(id),
  -- Spec 04 meet plan: each player chooses whether their emergency contacts get it.
  host_share_plan  boolean NOT NULL DEFAULT false,
  guest_share_plan boolean NOT NULL DEFAULT false,
  start_prompted_at timestamptz,
  end_prompted_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (host_id <> guest_id)
);
CREATE INDEX bookings_players ON bookings (host_id, guest_id);
CREATE INDEX bookings_slot ON bookings (slot_id) WHERE state IN ('invited', 'confirmed', 'checked_in');

CREATE TABLE emergency_contacts (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position   int NOT NULL CHECK (position BETWEEN 1 AND 3),
  name       text NOT NULL,
  -- E.164; stored because we must be able to reach them. Deleted with the account.
  phone      text NOT NULL,
  PRIMARY KEY (user_id, position)
);

-- Shield button and check-in prompts. "ok" also answers the end-of-meet prompt.
CREATE TABLE safety_events (
  id         bigserial PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES bookings(id),
  user_id    uuid REFERENCES users(id),
  kind       text NOT NULL CHECK (kind IN ('ok', 'get_me_out', 'alert_contacts', 'emergency', 'no_response_escalation', 'staff_flag')),
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX safety_events_booking ON safety_events (booking_id, kind);

-- No answer to the end-of-meet check-in: stage 1 reminds the player, stage 2 alerts their contacts
-- and opens a critical review (Spec 04).
CREATE TABLE meet_escalations (
  booking_id uuid NOT NULL REFERENCES bookings(id),
  user_id    uuid NOT NULL REFERENCES users(id),
  stage      int NOT NULL CHECK (stage IN (1, 2)),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (booking_id, user_id, stage)
);

-- "Did you feel safe?" after a meet. Never shown to the other player.
CREATE TABLE meet_feedback (
  booking_id uuid NOT NULL REFERENCES bookings(id),
  rater_id   uuid NOT NULL REFERENCES users(id),
  subject_id uuid NOT NULL REFERENCES users(id),
  felt_safe  boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (booking_id, rater_id)
);
CREATE INDEX meet_feedback_subject_unsafe ON meet_feedback (subject_id) WHERE NOT felt_safe;

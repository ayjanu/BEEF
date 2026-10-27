-- Silver beta catalog: how a game ended, per-seat scores, and whether it was rated.
ALTER TABLE results
  ADD COLUMN reason text NOT NULL DEFAULT 'complete',
  ADD COLUMN scores numeric[],
  ADD COLUMN rated boolean NOT NULL DEFAULT true;

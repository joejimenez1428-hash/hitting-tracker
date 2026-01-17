-- Hitting Tracker Database Schema v2
-- Run this in your Supabase SQL Editor
-- NOTE: If you already have tables, you'll need to add the pitch_type column:
-- ALTER TABLE reps ADD COLUMN pitch_type TEXT CHECK (pitch_type IN ('righty_fb', 'lefty_fb', 'righty_cb', 'lefty_cb'));
-- ALTER TABLE sessions ADD COLUMN pitch_type TEXT CHECK (pitch_type IN ('righty_fb', 'lefty_fb', 'righty_cb', 'lefty_cb'));

-- Drop existing tables if starting fresh (CAREFUL - this deletes all data!)
-- DROP TABLE IF EXISTS reps;
-- DROP TABLE IF EXISTS sessions;
-- DROP TABLE IF EXISTS players;

-- Players table
CREATE TABLE IF NOT EXISTS players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions table (one per training session)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pitch_type TEXT NOT NULL CHECK (pitch_type IN ('righty_fb', 'lefty_fb', 'righty_cb', 'lefty_cb')),
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Session players (which players were in a session)
CREATE TABLE IF NOT EXISTS session_players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, player_id)
);

-- Reps table (individual swings)
CREATE TABLE IF NOT EXISTS reps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  rep_number INTEGER NOT NULL,
  pitch_location INTEGER NOT NULL CHECK (pitch_location >= 1 AND pitch_location <= 9),
  hard_hit TEXT NOT NULL CHECK (hard_hit IN ('yes', 'no')),
  launch_angle TEXT NOT NULL CHECK (launch_angle IN ('fly', 'line', 'ground', 'miss')),
  direction TEXT NOT NULL CHECK (direction IN ('pull', 'middle', 'oppo')),
  spin TEXT NOT NULL CHECK (spin IN ('top', 'back', 'side')),
  pitch_type TEXT NOT NULL CHECK (pitch_type IN ('righty_fb', 'lefty_fb', 'righty_cb', 'lefty_cb')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_sessions_date ON sessions(date);
CREATE INDEX IF NOT EXISTS idx_session_players_session ON session_players(session_id);
CREATE INDEX IF NOT EXISTS idx_session_players_player ON session_players(player_id);
CREATE INDEX IF NOT EXISTS idx_reps_session_id ON reps(session_id);
CREATE INDEX IF NOT EXISTS idx_reps_player_id ON reps(player_id);
CREATE INDEX IF NOT EXISTS idx_reps_pitch_type ON reps(pitch_type);
CREATE INDEX IF NOT EXISTS idx_reps_created_at ON reps(created_at);

-- Enable Row Level Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE reps ENABLE ROW LEVEL SECURITY;

-- Allow all operations (you can tighten this later with auth)
DROP POLICY IF EXISTS "Allow all on players" ON players;
DROP POLICY IF EXISTS "Allow all on sessions" ON sessions;
DROP POLICY IF EXISTS "Allow all on session_players" ON session_players;
DROP POLICY IF EXISTS "Allow all on reps" ON reps;

CREATE POLICY "Allow all on players" ON players FOR ALL USING (true);
CREATE POLICY "Allow all on sessions" ON sessions FOR ALL USING (true);
CREATE POLICY "Allow all on session_players" ON session_players FOR ALL USING (true);
CREATE POLICY "Allow all on reps" ON reps FOR ALL USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at on players
DROP TRIGGER IF EXISTS update_players_updated_at ON players;
CREATE TRIGGER update_players_updated_at
  BEFORE UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

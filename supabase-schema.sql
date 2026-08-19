-- Create guild_members table
CREATE TABLE IF NOT EXISTS guild_members (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  user_tag TEXT NOT NULL,
  avatar_url TEXT,
  joined_server_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create voice_channels table
CREATE TABLE IF NOT EXISTS voice_channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create active_states table
CREATE TABLE IF NOT EXISTS active_states (
  user_id TEXT PRIMARY KEY REFERENCES guild_members(user_id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  user_tag TEXT NOT NULL,
  avatar_url TEXT,
  channel_id TEXT REFERENCES voice_channels(id) ON DELETE SET NULL,
  channel_name TEXT,
  guild_id TEXT NOT NULL,
  is_voice BOOLEAN DEFAULT true,
  is_video BOOLEAN DEFAULT false,
  is_streaming BOOLEAN DEFAULT false,
  self_mute BOOLEAN DEFAULT false,
  self_deaf BOOLEAN DEFAULT false,
  voice_start_time TIMESTAMP WITH TIME ZONE,
  video_start_time TIMESTAMP WITH TIME ZONE,
  stream_start_time TIMESTAMP WITH TIME ZONE,
  stream_title TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES guild_members(user_id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  user_tag TEXT NOT NULL,
  avatar_url TEXT,
  guild_id TEXT NOT NULL,
  guild_name TEXT,
  channel_id TEXT REFERENCES voice_channels(id) ON DELETE SET NULL,
  channel_name TEXT,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('voice', 'video', 'stream')),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_seconds INTEGER NOT NULL,
  is_ongoing BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create alert_logs table
CREATE TABLE IF NOT EXISTS alert_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  user_tag TEXT NOT NULL,
  avatar_url TEXT,
  channel_name TEXT,
  message TEXT NOT NULL,
  duration_formatted TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_activity_type ON sessions(activity_type);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_sessions_channel_id ON sessions(channel_id);
CREATE INDEX IF NOT EXISTS idx_alert_logs_timestamp ON alert_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_alert_logs_type ON alert_logs(type);
CREATE INDEX IF NOT EXISTS idx_active_states_channel_id ON active_states(channel_id);

-- Enable Row Level Security (optional, can be disabled for public access)
ALTER TABLE guild_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable all access for guild_members" ON guild_members;
DROP POLICY IF EXISTS "Enable all access for voice_channels" ON voice_channels;
DROP POLICY IF EXISTS "Enable all access for active_states" ON active_states;
DROP POLICY IF EXISTS "Enable all access for sessions" ON sessions;
DROP POLICY IF EXISTS "Enable all access for alert_logs" ON alert_logs;

-- Create policies to allow all operations (for development)
CREATE POLICY "Enable all access for guild_members" ON guild_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for voice_channels" ON voice_channels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for active_states" ON active_states FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for alert_logs" ON alert_logs FOR ALL USING (true) WITH CHECK (true);

-- Chat System Schema for EvalMatch Research Assistant
-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Chat sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  user_id TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_session ON chat_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_updated ON chat_sessions(updated_at DESC);

-- Auto-update updated_at on chat_sessions when messages are added
CREATE OR REPLACE FUNCTION update_chat_session_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_sessions SET updated_at = NOW() WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_session_on_message ON chat_messages;
CREATE TRIGGER update_session_on_message
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION update_chat_session_timestamp();

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Chat schema created successfully!';
END $$;

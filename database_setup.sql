-- Create the user_chats table for storing chat data
CREATE TABLE user_chats (
  id SERIAL PRIMARY KEY,
  chat_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'New Chat',
  description TEXT,
  role TEXT,
  role_description TEXT,
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on user_id for faster lookups
CREATE INDEX idx_user_chats_user_id ON user_chats(user_id);

-- Create an index on chat_id for faster lookups
CREATE INDEX idx_user_chats_chat_id ON user_chats(chat_id);

-- Enable Row Level Security
ALTER TABLE user_chats ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows users to select only their own chats
CREATE POLICY select_own_chats ON user_chats 
  FOR SELECT USING (auth.uid() = user_id);

-- Create a policy that allows users to insert only their own chats
CREATE POLICY insert_own_chats ON user_chats 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create a policy that allows users to update only their own chats
CREATE POLICY update_own_chats ON user_chats 
  FOR UPDATE USING (auth.uid() = user_id);

-- Create a policy that allows users to delete only their own chats
CREATE POLICY delete_own_chats ON user_chats 
  FOR DELETE USING (auth.uid() = user_id);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to call the function before update
CREATE TRIGGER update_user_chats_updated_at
BEFORE UPDATE ON user_chats
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Note: You may need to adjust permissions if using a specific schema
-- GRANT ALL ON TABLE user_chats TO authenticated;
-- GRANT USAGE, SELECT ON SEQUENCE user_chats_id_seq TO authenticated; 
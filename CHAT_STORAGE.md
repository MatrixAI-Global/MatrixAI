# MatrixAI Chat Storage Implementation

This document explains the implementation of the chat storage system in MatrixAI using Supabase.

## Database Structure

The chat data is stored in a single table called `user_chats` with the following structure:

```sql
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
```

### Table Fields

- `id`: Auto-incrementing primary key
- `chat_id`: Unique identifier for the chat (client-generated)
- `user_id`: Reference to the authenticated user who owns the chat
- `name`: Name of the chat (defaults to "New Chat")
- `description`: Optional description of the chat
- `role`: Selected role for the AI bot (e.g., "Doctor", "Teacher")
- `role_description`: Detailed description of the AI bot's role
- `messages`: JSON array containing all messages in the chat
- `created_at`: Timestamp when the chat was created
- `updated_at`: Timestamp when the chat was last updated

### Message Structure

Each message in the `messages` JSONB array has the following structure:

```json
{
  "id": "1625482937123",
  "text": "Hello, how can I help you?",
  "sender": "bot",
  "timestamp": "2023-07-05T15:22:17.123Z"
}
```

For messages containing images, the `text` field contains the URL to the image stored in Supabase Storage, and the client-side code processes these to display as images.

## Security and Performance

1. **Row Level Security**: The table uses Row Level Security to ensure users can only access their own chats.

2. **Indexes**: Indexes are created on `user_id` and `chat_id` for faster lookups.

3. **Real-time Updates**: The application uses Supabase's real-time subscription feature to receive updates when chats are modified.

## Client-Side Implementation

1. **Loading Chats**: All chats for a user are loaded when the BotScreen component mounts.

2. **Creating Chats**: New chats are created with a unique `chat_id` and empty message array.

3. **Sending Messages**: Messages are added to the `messages` array and the chat is updated in Supabase.

4. **Real-time Updates**: The application subscribes to changes in the `user_chats` table to receive updates in real-time.

5. **Image Handling**: Images are uploaded to Supabase Storage and the URL is saved in the message's `text` field.

## How to Set Up

1. Create the `user_chats` table in your Supabase database using the SQL in the `database_setup.sql` file.

2. Set up the Row Level Security policies as defined in the SQL file.

3. Create a Storage bucket called `user-uploads` with appropriate permissions for authenticated users.

## Benefits Over Previous Implementation

1. **Direct Database Access**: Eliminates the need for an external API server.

2. **Reduced Latency**: Direct communication with Supabase reduces network overhead.

3. **Real-time Updates**: Chat data is automatically synchronized across devices.

4. **Simplified State Management**: Single source of truth in the Supabase database.

5. **Improved Security**: Row Level Security ensures users can only access their own data.

6. **Reduced Server Costs**: No need for a dedicated API server to handle chat operations. 
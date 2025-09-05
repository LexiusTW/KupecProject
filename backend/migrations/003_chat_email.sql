--migration/003_chat_email.sql

-- CHATS
CREATE TABLE IF NOT EXISTS chats (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- CHAT PARTICIPANTS
CREATE TABLE IF NOT EXISTS chat_participants (
  id SERIAL PRIMARY KEY,
  chat_id INT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  buyer_id INT REFERENCES buyers(id) ON DELETE CASCADE,
  seller_id INT REFERENCES sellers(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (
    (buyer_id IS NOT NULL AND seller_id IS NULL)
    OR (buyer_id IS NULL AND seller_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_chat_participants_chat ON chat_participants(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_buyer ON chat_participants(buyer_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_seller ON chat_participants(seller_id);

-- CHAT MESSAGES
CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  chat_id INT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_buyer_id INT REFERENCES buyers(id) ON DELETE SET NULL,
  sender_seller_id INT REFERENCES sellers(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE,
  CHECK (
    (sender_buyer_id IS NOT NULL AND sender_seller_id IS NULL)
    OR (sender_buyer_id IS NULL AND sender_seller_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_chat ON chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_b ON chat_messages(sender_buyer_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_s ON chat_messages(sender_seller_id);

-- EMAILS
CREATE TABLE IF NOT EXISTS emails (
  id SERIAL PRIMARY KEY,
  sender_buyer_id INT REFERENCES buyers(id) ON DELETE SET NULL,
  sender_seller_id INT REFERENCES sellers(id) ON DELETE SET NULL,
  receiver_buyer_id INT REFERENCES buyers(id) ON DELETE SET NULL,
  receiver_seller_id INT REFERENCES sellers(id) ON DELETE SET NULL,
  subject VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  CHECK (
    (sender_buyer_id IS NOT NULL OR sender_seller_id IS NOT NULL)
    AND (receiver_buyer_id IS NOT NULL OR receiver_seller_id IS NOT NULL)
  ),
  CHECK (
    NOT (sender_buyer_id IS NOT NULL AND sender_seller_id IS NOT NULL)
  ),
  CHECK (
    NOT (receiver_buyer_id IS NOT NULL AND receiver_seller_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_emails_sender_b ON emails(sender_buyer_id);
CREATE INDEX IF NOT EXISTS idx_emails_sender_s ON emails(sender_seller_id);
CREATE INDEX IF NOT EXISTS idx_emails_receiver_b ON emails(receiver_buyer_id);
CREATE INDEX IF NOT EXISTS idx_emails_receiver_s ON emails(receiver_seller_id);

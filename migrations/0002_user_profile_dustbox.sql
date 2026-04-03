-- Add user profile fields
ALTER TABLE users ADD COLUMN nickname TEXT;
ALTER TABLE users ADD COLUMN photo_r2_key TEXT;

-- Add soft-delete to patterns
ALTER TABLE patterns ADD COLUMN deleted_at INTEGER;

-- Add soft-delete to files
ALTER TABLE files ADD COLUMN deleted_at INTEGER;

-- Index for dustbox queries
CREATE INDEX idx_patterns_deleted ON patterns(user_id, deleted_at);
CREATE INDEX idx_files_deleted ON files(user_id, deleted_at);

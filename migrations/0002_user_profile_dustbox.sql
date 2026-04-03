-- Add user profile fields
ALTER TABLE users ADD COLUMN nickname TEXT;
ALTER TABLE users ADD COLUMN photo_r2_key TEXT;

-- Add soft-delete to compositions
ALTER TABLE compositions ADD COLUMN deleted_at INTEGER;

-- Add soft-delete to assets
ALTER TABLE assets ADD COLUMN deleted_at INTEGER;

-- Index for dustbox queries
CREATE INDEX idx_compositions_deleted ON compositions(user_id, deleted_at);
CREATE INDEX idx_assets_deleted ON assets(user_id, deleted_at);

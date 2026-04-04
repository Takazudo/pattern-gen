CREATE TABLE font_favorites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  font_family TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(user_id, font_family)
);

CREATE INDEX idx_font_favorites_user ON font_favorites(user_id);

ALTER TABLE posts ADD COLUMN lesson_content TEXT CHECK (
  lesson_content IS NULL OR (json_valid(lesson_content) AND json_type(lesson_content) = 'array'
  AND length(lesson_content) <= 48000 AND category = 'DISCOVERY' AND visibility = 'PRIVATE')
);

CREATE TABLE lesson_assets (
  id TEXT PRIMARY KEY NOT NULL,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  uploaded_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  post_id TEXT,
  mime TEXT NOT NULL CHECK (mime IN ('image/webp', 'application/pdf')),
  byte_size INTEGER NOT NULL CHECK (byte_size BETWEEN 1 AND 3145728),
  ready INTEGER NOT NULL DEFAULT 0 CHECK (ready IN (0, 1)),
  created_at TEXT NOT NULL,
  FOREIGN KEY (post_id, class_id) REFERENCES posts(id, class_id) ON DELETE CASCADE
);
CREATE INDEX lesson_drafts ON lesson_assets(class_id, uploaded_by, created_at) WHERE post_id IS NULL;

CREATE TABLE lesson_asset_parts (
  asset_id TEXT NOT NULL REFERENCES lesson_assets(id) ON DELETE CASCADE,
  part INTEGER NOT NULL CHECK (part BETWEEN 0 AND 6),
  data_base64 TEXT NOT NULL CHECK (length(data_base64) BETWEEN 4 AND 655360),
  PRIMARY KEY (asset_id, part)
);

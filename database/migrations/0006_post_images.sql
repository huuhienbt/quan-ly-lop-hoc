-- Small, normalized article covers are durable without a separate storage service.
-- The application inserts an image only in the same guarded batch as its post.
CREATE TABLE post_images (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  uploaded_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  content_type TEXT NOT NULL CHECK (content_type = 'image/webp'),
  byte_size INTEGER NOT NULL CHECK (typeof(byte_size) = 'integer' AND byte_size BETWEEN 1 AND 262144),
  width INTEGER NOT NULL CHECK (typeof(width) = 'integer' AND width BETWEEN 1 AND 1600),
  height INTEGER NOT NULL CHECK (typeof(height) = 'integer' AND height BETWEEN 1 AND 1600),
  data_base64 TEXT NOT NULL CHECK (
    typeof(data_base64) = 'text' AND length(data_base64) = ((byte_size + 2) / 3) * 4
    AND data_base64 NOT GLOB '*[^A-Za-z0-9+/=]*'
  ),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_post_images_class ON post_images(class_id, created_at);

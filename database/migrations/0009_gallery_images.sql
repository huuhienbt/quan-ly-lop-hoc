-- Device photos belong to media assets and retain the album's live access policy.
-- Normalized small WebP files do not need a separate storage account.
ALTER TABLE photos ADD COLUMN archived_at TEXT;

CREATE TABLE gallery_images (
  asset_id TEXT PRIMARY KEY NOT NULL CHECK (length(asset_id) = 36),
  class_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type = 'image/webp'),
  byte_size INTEGER NOT NULL CHECK (typeof(byte_size) = 'integer' AND byte_size BETWEEN 1 AND 262144),
  width INTEGER NOT NULL CHECK (typeof(width) = 'integer' AND width BETWEEN 1 AND 1600),
  height INTEGER NOT NULL CHECK (typeof(height) = 'integer' AND height BETWEEN 1 AND 1600),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64 AND sha256 NOT GLOB '*[^a-f0-9]*'),
  data_base64 TEXT NOT NULL CHECK (
    typeof(data_base64) = 'text' AND length(data_base64) = ((byte_size + 2) / 3) * 4
    AND data_base64 NOT GLOB '*[^A-Za-z0-9+/=]*'
  ),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (asset_id, class_id) REFERENCES media_assets(id, class_id) ON DELETE RESTRICT
);
CREATE INDEX idx_gallery_images_class ON gallery_images(class_id, created_at);
CREATE INDEX idx_gallery_active_photos ON photos(album_id, archived_at, sort_order, created_at);

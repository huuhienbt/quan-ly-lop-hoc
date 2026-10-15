-- Widen the visual-theme CHECK without changing the saved selection or history.
-- No tables reference site_settings. Its only foreign key points to users.
-- Wrangler runs this migration atomically; do not add BEGIN/COMMIT or disable FKs.
CREATE TABLE site_settings_harmony (
  id TEXT PRIMARY KEY NOT NULL CHECK (id = 'site'),
  site_theme TEXT NOT NULL DEFAULT 'playful'
    CHECK (site_theme IN ('playful', 'discovery', 'harmony')),
  revision INTEGER NOT NULL DEFAULT 1
    CHECK (typeof(revision) = 'integer' AND revision >= 1),
  updated_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO site_settings_harmony (id, site_theme, revision, updated_by, updated_at)
SELECT id, site_theme, revision, updated_by, updated_at FROM site_settings;

DROP TABLE site_settings;
ALTER TABLE site_settings_harmony RENAME TO site_settings;

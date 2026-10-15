-- One global visual setting. Existing installations retain Giao diện 1 until
-- a verified Super Admin explicitly applies a different theme.
CREATE TABLE site_settings (
  id TEXT PRIMARY KEY NOT NULL CHECK (id = 'site'),
  site_theme TEXT NOT NULL DEFAULT 'playful'
    CHECK (site_theme IN ('playful', 'discovery')),
  revision INTEGER NOT NULL DEFAULT 1
    CHECK (typeof(revision) = 'integer' AND revision >= 1),
  updated_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO site_settings (id, site_theme, revision)
VALUES ('site', 'playful', 1);

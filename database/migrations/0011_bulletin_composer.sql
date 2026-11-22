-- Keep existing lesson documents and their private-only constraint intact.
ALTER TABLE posts ADD COLUMN bulletin_content TEXT CHECK (
  bulletin_content IS NULL OR (json_valid(bulletin_content) AND json_type(bulletin_content) = 'array'
    AND length(bulletin_content) <= 48000 AND category <> 'DISCOVERY')
);
ALTER TABLE posts ADD COLUMN post_date TEXT CHECK (
  post_date IS NULL OR post_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
);

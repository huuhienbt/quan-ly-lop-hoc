"""Album device-photo integrity, without a real Cloudflare account or pupil data."""

import sqlite3
import unittest
from pathlib import Path


class ClassGallerySchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        for migration in sorted((Path(__file__).resolve().parents[1] / 'migrations').glob('*.sql')):
            self.db.executescript(migration.read_text(encoding='utf-8'))
        self.db.executescript("""
          INSERT INTO users (id, email, name, role) VALUES
            ('gallery-editor', 'gallery@example.invalid', 'Synthetic editor', 'SUPER_ADMIN');
          INSERT INTO academic_years (id, school_id, name, starts_on, ends_on) VALUES
            ('gallery-year', 'school-ben-tre', 'Synthetic gallery year', '2026-09-01', '2027-05-31');
          INSERT INTO classes (id, school_id, academic_year_id, name, slug, grade, created_by) VALUES
            ('gallery-a', 'school-ben-tre', 'gallery-year', 'Fixture A', 'gallery-a', 4, 'gallery-editor'),
            ('gallery-b', 'school-ben-tre', 'gallery-year', 'Fixture B', 'gallery-b', 4, 'gallery-editor');
          INSERT INTO albums (id, class_id, title, created_by) VALUES
            ('album-a', 'gallery-a', 'Synthetic A', 'gallery-editor'),
            ('album-b', 'gallery-b', 'Synthetic B', 'gallery-editor');
          INSERT INTO media_assets (id, class_id, uploaded_by, url, mime_type, width, height) VALUES
            ('10000000-0000-4000-8000-000000000001', 'gallery-a', 'gallery-editor',
              '/api/gallery-images/10000000-0000-4000-8000-000000000001', 'image/webp', 1, 1),
            ('10000000-0000-4000-8000-000000000002', 'gallery-b', 'gallery-editor',
              '/api/gallery-images/10000000-0000-4000-8000-000000000002', 'image/webp', 1, 1);
        """)

    def image(self, **overrides):
        data = dict(asset_id='10000000-0000-4000-8000-000000000001', class_id='gallery-a',
                    content_type='image/webp', byte_size=3, width=1, height=1,
                    sha256='a' * 64, data_base64='YWJj')
        data.update(overrides)
        self.db.execute('''INSERT INTO gallery_images
          (asset_id, class_id, content_type, byte_size, width, height, sha256, data_base64)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)''', tuple(data.values()))

    def photo(self, **overrides):
        data = dict(id='fixture-photo', class_id='gallery-a', album_id='album-a',
                    asset_id='10000000-0000-4000-8000-000000000001', added_by='gallery-editor')
        data.update(overrides)
        self.db.execute('''INSERT INTO photos (id, class_id, album_id, asset_id, added_by)
          VALUES (?, ?, ?, ?, ?)''', tuple(data.values()))

    def test_migration_does_not_create_any_photo_or_change_album_default_privacy(self):
        self.assertEqual(self.db.execute('SELECT count(*) FROM gallery_images').fetchone()[0], 0)
        self.assertEqual(self.db.execute('SELECT count(*) FROM photos').fetchone()[0], 0)
        self.assertEqual(self.db.execute("SELECT visibility FROM albums WHERE id = 'album-a'").fetchone()[0], 'PRIVATE')

    def test_image_requires_existing_asset_in_exact_class(self):
        for overrides in [dict(class_id='gallery-b'),
                          dict(asset_id='10000000-0000-4000-8000-000000000002'),
                          dict(asset_id='10000000-0000-4000-8000-000000000099')]:
            with self.subTest(overrides=overrides), self.assertRaises(sqlite3.IntegrityError):
                self.image(**overrides)
        self.image()

    def test_each_asset_has_only_one_stored_image(self):
        self.image()
        with self.assertRaises(sqlite3.IntegrityError):
            self.image()

    def test_only_small_static_webp_with_bounded_pixel_dimensions_can_be_stored(self):
        invalid = [dict(content_type='image/svg+xml'), dict(byte_size=0), dict(byte_size=-1),
                   dict(byte_size=262145), dict(byte_size=2.5), dict(width=0), dict(width=1601),
                   dict(height=0), dict(height=1601), dict(width=1.5), dict(height=2.5)]
        for overrides in invalid:
            with self.subTest(overrides=overrides), self.assertRaises(sqlite3.IntegrityError):
                self.image(**overrides)

    def test_base64_length_and_alphabet_and_sha256_are_bounded(self):
        for overrides in [dict(data_base64='YWJ'), dict(data_base64='YWJjYQ=='),
                          dict(data_base64='!!!!'), dict(data_base64='YW J'),
                          dict(sha256='a' * 63), dict(sha256='G' * 64), dict(sha256='-' * 64)]:
            with self.subTest(overrides=overrides), self.assertRaises(sqlite3.IntegrityError):
                self.image(**overrides)
        self.image()

    def test_photo_album_asset_and_class_must_match(self):
        for overrides in [dict(class_id='gallery-b'), dict(album_id='album-b'),
                          dict(asset_id='10000000-0000-4000-8000-000000000002')]:
            with self.subTest(overrides=overrides), self.assertRaises(sqlite3.IntegrityError):
                self.photo(**overrides)
        self.image()
        self.photo()

    def test_soft_archive_retains_photo_asset_and_history_references(self):
        self.image()
        self.photo()
        self.db.execute("UPDATE photos SET archived_at = '2026-10-18T00:00:00Z' WHERE id = 'fixture-photo'")
        self.db.execute("UPDATE albums SET archived_at = '2026-10-18T00:00:00Z' WHERE id = 'album-a'")
        self.assertEqual(self.db.execute('SELECT count(*) FROM photos WHERE archived_at IS NOT NULL').fetchone()[0], 1)
        self.assertEqual(self.db.execute('SELECT count(*) FROM gallery_images').fetchone()[0], 1)
        for sql in ["DELETE FROM media_assets WHERE class_id = 'gallery-a'", "DELETE FROM albums WHERE id = 'album-a'",
                    "DELETE FROM classes WHERE id = 'gallery-a'"]:
            with self.subTest(sql=sql), self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(sql)
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_gallery_pixels_are_separate_from_article_cover_storage(self):
        self.image()
        self.assertEqual(self.db.execute('SELECT count(*) FROM post_images').fetchone()[0], 0)
        self.assertEqual(self.db.execute('SELECT count(*) FROM gallery_images').fetchone()[0], 1)


if __name__ == '__main__':
    unittest.main(verbosity=2)

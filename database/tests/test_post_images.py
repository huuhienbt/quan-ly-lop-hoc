"""Bounded image storage integrity, without accessing any real image or database."""

import base64
import sqlite3
import unittest
from pathlib import Path


class PostImageSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        migrations = Path(__file__).resolve().parents[1] / 'migrations'
        for migration in sorted(migrations.glob('*.sql')):
            self.db.executescript(migration.read_text(encoding='utf-8'))
        self.db.executescript("""
          INSERT INTO users (id, email, name, role) VALUES ('image-editor', 'image@example.invalid', 'Synthetic editor', 'SUPER_ADMIN');
          INSERT INTO academic_years (id, school_id, name, starts_on, ends_on)
            VALUES ('image-year', 'school-ben-tre', 'Image year', '2026-09-01', '2027-05-31');
          INSERT INTO classes (id, school_id, academic_year_id, name, slug, grade, created_by)
            VALUES ('image-class', 'school-ben-tre', 'image-year', 'Image class', 'image-class', 4, 'image-editor');
        """)
        self.image_id = '30d7de2e-2861-4af3-9e38-b2e7e2db2bf7'
        self.db.execute('''INSERT INTO post_images
          (id, class_id, uploaded_by, content_type, byte_size, width, height, data_base64)
          VALUES (?, 'image-class', 'image-editor', 'image/webp', 3, 80, 40, ?)''',
                        (self.image_id, base64.b64encode(b'abc').decode()))

    def reject(self, column, value):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(f'UPDATE post_images SET {column} = ?', (value,))

    def test_only_normalized_webp_and_positive_bounded_pixel_dimensions(self):
        for column, value in [('content_type', 'image/svg+xml'), ('content_type', 'image/png'),
                              ('width', 0), ('width', 1601), ('width', 1.5), ('height', -1), ('height', 1601)]:
            with self.subTest(column=column, value=value):
                self.reject(column, value)

    def test_encoded_bytes_are_bounded_and_consistent(self):
        for column, value in [('byte_size', 0), ('byte_size', 262145), ('byte_size', 1.5),
                              ('data_base64', 'abc'), ('data_base64', '<x=>')]:
            with self.subTest(column=column, value=value):
                self.reject(column, value)
        # The upper bound remains below the authenticated Worker's batch payload limit.
        data = base64.b64encode(b'x' * 262144).decode()
        self.db.execute('UPDATE post_images SET byte_size = 262144, data_base64 = ?', (data,))
        self.assertLess(len(data), 350000)

    def test_missing_owner_class_or_uploader_cannot_be_stored(self):
        self.reject('class_id', 'missing-class')
        self.reject('uploaded_by', 'missing-user')

    def test_hard_deleting_referenced_owners_is_restricted(self):
        for sql in ["DELETE FROM classes WHERE id = 'image-class'", "DELETE FROM users WHERE id = 'image-editor'"]:
            with self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(sql)
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_storage_is_empty_until_an_editor_saves_an_image(self):
        self.assertEqual(self.db.execute('SELECT count(*) FROM post_images').fetchone()[0], 1)
        self.assertEqual(self.db.execute('SELECT count(*) FROM posts').fetchone()[0], 0)
        self.assertEqual(self.db.execute('SELECT count(*) FROM students').fetchone()[0], 0)


if __name__ == '__main__':
    unittest.main(verbosity=2)

"""Persisted theme selection must be reversible without changing class data."""

import sqlite3
import unittest
from pathlib import Path


MIGRATIONS = Path(__file__).resolve().parents[1] / 'migrations'


class SiteThemeSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        for name in ('0001_initial.sql', '0002_student_accounts.sql', '0003_class_content.sql'):
            self.db.executescript((MIGRATIONS / name).read_text(encoding='utf-8'))
        self.db.executescript("""
          INSERT INTO users (id, email, name, role)
            VALUES ('theme-admin', 'theme-admin@example.invalid', 'Synthetic theme administrator', 'SUPER_ADMIN');
          INSERT INTO academic_years (id, school_id, name, starts_on, ends_on)
            VALUES ('theme-year', 'school-ben-tre', 'Theme fixture year', '2026-09-01', '2027-05-31');
          INSERT INTO classes (id, school_id, academic_year_id, name, slug, grade, created_by)
            VALUES ('theme-class', 'school-ben-tre', 'theme-year', 'Synthetic classroom', 'synthetic-theme-class', 4, 'theme-admin');
          INSERT INTO students (id, school_id, full_name)
            VALUES ('theme-pupil', 'school-ben-tre', 'Synthetic theme pupil');
          INSERT INTO posts (id, class_id, author_id, title, body)
            VALUES ('theme-post', 'theme-class', 'theme-admin', 'Existing post', 'Existing body');
        """)
        self.before = self.snapshot()
        self.db.executescript((MIGRATIONS / '0004_site_theme.sql').read_text(encoding='utf-8'))
        self.db.executescript((MIGRATIONS / '0005_harmony_theme.sql').read_text(encoding='utf-8'))

    def snapshot(self):
        tables = self.db.execute("SELECT name FROM sqlite_master WHERE type = 'table' "
                                 "AND name NOT IN ('site_settings', 'audit_logs') ORDER BY name").fetchall()
        return [(name, self.db.execute(f'SELECT * FROM "{name}" ORDER BY rowid').fetchall()) for (name,) in tables]

    def reject(self, sql, params=()):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(sql, params)

    def test_migration_seeds_exactly_one_theme_one_setting(self):
        self.assertEqual(self.db.execute('SELECT id, site_theme, revision, updated_by FROM site_settings').fetchall(),
                         [('site', 'playful', 1, None)])
        timestamp = self.db.execute('SELECT updated_at FROM site_settings').fetchone()[0]
        self.assertIsNotNone(self.db.execute('SELECT datetime(?)', (timestamp,)).fetchone()[0])
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_migration_preserves_all_existing_class_data(self):
        self.assertEqual(self.snapshot(), self.before)
        self.assertEqual(self.db.execute("SELECT count(*) FROM sqlite_master WHERE type = 'table'").fetchone()[0], 30)

    def test_singleton_key_prevents_extra_settings_rows(self):
        for setting_id in ('other', '', 'SITE', None):
            with self.subTest(setting_id=setting_id):
                self.reject('INSERT INTO site_settings (id) VALUES (?)', (setting_id,))
        self.reject("INSERT INTO site_settings (id) VALUES ('site')")
        self.reject("UPDATE site_settings SET id = 'other'")

    def test_only_saved_theme_one_two_and_three_are_valid(self):
        for theme in ('discovery', 'playful', 'harmony'):
            self.db.execute('UPDATE site_settings SET site_theme = ?', (theme,))
        for theme in ('unknown', '', 'PLAYFUL', 'Discovery', ' harmony', 'HARMONY', None):
            with self.subTest(theme=theme):
                self.reject('UPDATE site_settings SET site_theme = ?', (theme,))

    def test_revision_is_a_positive_integer(self):
        for revision in (1, 2, 100):
            self.db.execute('UPDATE site_settings SET revision = ?', (revision,))
        for revision in (0, -1, 1.5, 'not-a-number', None):
            with self.subTest(revision=revision):
                self.reject('UPDATE site_settings SET revision = ?', (revision,))

    def test_updated_by_requires_an_existing_user_and_keeps_history(self):
        self.reject("UPDATE site_settings SET updated_by = 'missing-user'")
        self.db.execute("INSERT INTO users (id, email, name, role) VALUES "
                        "('setting-editor', 'setting-editor@example.invalid', 'Synthetic settings editor', 'SUPER_ADMIN')")
        self.db.execute("UPDATE site_settings SET updated_by = 'setting-editor'")
        self.reject("DELETE FROM users WHERE id = 'setting-editor'")
        self.assertEqual(self.db.execute('SELECT updated_by FROM site_settings').fetchone()[0], 'setting-editor')

    def test_database_supports_reversible_theme_switch_without_other_writes(self):
        for theme, revision in (('harmony', 2), ('playful', 3), ('discovery', 4)):
            self.db.execute('UPDATE site_settings SET site_theme = ?, revision = ?, updated_by = ? WHERE id = ?',
                            (theme, revision, 'theme-admin', 'site'))
        self.assertEqual(self.db.execute('SELECT site_theme, revision FROM site_settings').fetchone(), ('discovery', 4))
        self.assertEqual(self.snapshot(), self.before)

    def test_harmony_migration_preserves_existing_selection_revision_editor_timestamp_and_audit(self):
        db = sqlite3.connect(':memory:')
        self.addCleanup(db.close)
        for migration in sorted(MIGRATIONS.glob('*.sql')):
            if migration.name >= '0005_harmony_theme.sql':
                break
            db.executescript(migration.read_text(encoding='utf-8'))
        db.execute("INSERT INTO users (id, email, name, role) VALUES "
                   "('earlier-editor', 'earlier-editor@example.invalid', 'Synthetic earlier editor', 'SUPER_ADMIN')")
        saved_timestamp = '2026-10-15T12:34:56.123456Z'
        db.execute("UPDATE site_settings SET site_theme = 'discovery', revision = 37, "
                   "updated_by = 'earlier-editor', updated_at = ?", (saved_timestamp,))
        db.execute("INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, details_json) "
                   "VALUES ('existing-theme-audit', 'earlier-editor', 'SITE_THEME_UPDATED', 'site_settings', "
                   "'site', '{\"theme\":\"discovery\",\"revision\":37}')")
        tables = db.execute("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").fetchall()
        before = [(name, db.execute(f'SELECT * FROM "{name}" ORDER BY rowid').fetchall()) for (name,) in tables]
        db.executescript((MIGRATIONS / '0005_harmony_theme.sql').read_text(encoding='utf-8'))
        after = [(name, db.execute(f'SELECT * FROM "{name}" ORDER BY rowid').fetchall()) for (name,) in tables]
        self.assertEqual(after, before)
        self.assertEqual(db.execute('SELECT * FROM site_settings').fetchone(),
                         ('site', 'discovery', 37, 'earlier-editor', saved_timestamp))
        self.assertEqual(db.execute("SELECT count(*) FROM sqlite_master WHERE name = 'site_settings_harmony'").fetchone()[0], 0)
        self.assertEqual(db.execute('PRAGMA foreign_key_check').fetchall(), [])
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute("DELETE FROM users WHERE id = 'earlier-editor'")
        db.execute("UPDATE site_settings SET site_theme = 'harmony'")
        self.assertEqual(db.execute('SELECT revision, updated_by, updated_at FROM site_settings').fetchone(),
                         (37, 'earlier-editor', saved_timestamp))

    def test_harmony_migration_has_no_inbound_foreign_keys_to_drop(self):
        tables = self.db.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
        inbound = [(name, fk) for (name,) in tables
                   for fk in self.db.execute(f'PRAGMA foreign_key_list("{name}")').fetchall()
                   if fk[2] == 'site_settings']
        self.assertEqual(inbound, [])


if __name__ == '__main__':
    unittest.main(verbosity=2)

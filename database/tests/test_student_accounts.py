"""Student login constraints across both migrations, without external services."""

import sqlite3
import unittest
from pathlib import Path


MIGRATIONS = Path(__file__).resolve().parents[1] / 'migrations'
VALID_HASH = 'scrypt$16384$8$1$' + 'ab' * 16 + '$' + 'cd' * 64


class StudentAccountSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        for migration in sorted(MIGRATIONS.glob('*.sql')):
            self.db.executescript(migration.read_text(encoding='utf-8'))
        self.db.executescript("""
          INSERT INTO students (id, school_id, full_name) VALUES
            ('child-1', 'school-ben-tre', 'Học sinh một'),
            ('child-2', 'school-ben-tre', 'Học sinh hai');
        """)

    def account(self, account_id='family-1', phone='0912345678', password_hash=VALID_HASH):
        self.db.execute(
            'INSERT INTO student_accounts (id, phone, password_hash) VALUES (?, ?, ?)',
            (account_id, phone, password_hash),
        )

    def reject(self, sql, params=()):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(sql, params)

    def test_default_account_requires_password_change(self):
        self.account()
        row = self.db.execute('''SELECT must_change_password, status, session_version,
            failed_attempts, failure_window_started_at, locked_until,
            last_login_at, password_changed_at FROM student_accounts''').fetchone()
        self.assertEqual(row, (1, 'ACTIVE', 1, 0, None, None, None, None))

    def test_phone_is_canonical_ascii_vietnam_mobile_number(self):
        for index, prefix in enumerate(('03', '05', '07', '08', '09')):
            with self.subTest(prefix=prefix):
                self.account(f'valid-{index}', prefix + '12345678')
        invalid = (
            '+84912345678', '84912345678', '091 234 5678', '091-234-5678',
            '091234567', '09123456789', '0212345678', '0612345678',
            '1912345678', '091234567x', '091234567８', ' 0912345678',
        )
        for index, phone in enumerate(invalid):
            with self.subTest(phone=phone):
                self.reject(
                    'INSERT INTO student_accounts (id, phone, password_hash) VALUES (?, ?, ?)',
                    (f'invalid-{index}', phone, VALID_HASH),
                )

    def test_phone_is_unique(self):
        self.account()
        self.reject(
            'INSERT INTO student_accounts (id, phone, password_hash) VALUES (?, ?, ?)',
            ('another-family', '0912345678', VALID_HASH),
        )

    def test_hash_matches_supported_scrypt_format(self):
        self.account()
        self.account('long-salt', '0812345678', 'scrypt$16384$8$1$' + 'ab' * 64 + '$' + 'cd' * 64)
        invalid = (
            '', '123456789',
            VALID_HASH.replace('16384', '32768', 1),
            VALID_HASH.replace('$8$', '$0$', 1),
            'scrypt$16384$8$1$' + 'ab' * 15 + '$' + 'cd' * 64,
            'scrypt$16384$8$1$' + 'a' * 33 + '$' + 'cd' * 64,
            'scrypt$16384$8$1$' + 'ab' * 65 + '$' + 'cd' * 64,
            'scrypt$16384$8$1$' + 'ag' * 16 + '$' + 'cd' * 64,
            'scrypt$16384$8$1$' + 'AB' * 16 + '$' + 'cd' * 64,
            'scrypt$16384$8$1$' + 'ab' * 16 + ':' + 'cd' * 64,
            VALID_HASH[:-1], VALID_HASH + 'c',
            VALID_HASH[:-1] + 'g', VALID_HASH + '\n',
        )
        for password_hash in invalid:
            with self.subTest(hash_format=password_hash[:20]):
                self.reject(
                    'UPDATE student_accounts SET password_hash = ? WHERE id = ?',
                    (password_hash, 'family-1'),
                )
        self.assertEqual(self.db.execute(
            "SELECT password_hash FROM student_accounts WHERE id = 'family-1'"
        ).fetchone()[0], VALID_HASH)

    def test_security_flags_and_counters_reject_invalid_values(self):
        self.account()
        invalid = (
            ('must_change_password', -1), ('must_change_password', 2),
            ('status', 'PENDING'), ('session_version', 0),
            ('session_version', 1.5), ('failed_attempts', -1),
            ('failed_attempts', 6), ('failed_attempts', 1.5),
        )
        for field, value in invalid:
            with self.subTest(field=field, value=value):
                self.reject(f'UPDATE student_accounts SET {field} = ? WHERE id = ?', (value, 'family-1'))

    def test_one_family_can_access_multiple_children(self):
        self.account()
        self.db.executemany(
            'INSERT INTO student_account_students (account_id, student_id) VALUES (?, ?)',
            [('family-1', 'child-1'), ('family-1', 'child-2')],
        )
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM student_account_students').fetchone()[0], 2)
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_student_cannot_belong_to_two_login_accounts(self):
        self.account()
        self.account('family-2', '0812345678')
        self.db.execute(
            'INSERT INTO student_account_students (account_id, student_id) VALUES (?, ?)',
            ('family-1', 'child-1'),
        )
        self.reject(
            'INSERT INTO student_account_students (account_id, student_id) VALUES (?, ?)',
            ('family-2', 'child-1'),
        )
        self.reject(
            'INSERT INTO student_account_students (account_id, student_id) VALUES (?, ?)',
            ('family-1', 'child-1'),
        )

    def test_link_requires_existing_account_and_student(self):
        self.account()
        for account_id, student_id in (('missing', 'child-1'), ('family-1', 'missing')):
            with self.subTest(account=account_id, student=student_id):
                self.reject(
                    'INSERT INTO student_account_students (account_id, student_id) VALUES (?, ?)',
                    (account_id, student_id),
                )

    def test_linked_student_cannot_be_deleted(self):
        self.account()
        self.db.execute(
            "INSERT INTO student_account_students (account_id, student_id) VALUES ('family-1', 'child-1')"
        )
        self.reject("DELETE FROM students WHERE id = 'child-1'")

    def test_deleting_login_clears_links_without_deleting_pupils(self):
        self.account()
        self.db.execute(
            "INSERT INTO student_account_students (account_id, student_id) VALUES ('family-1', 'child-1')"
        )
        self.db.execute("DELETE FROM student_accounts WHERE id = 'family-1'")
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM student_account_students').fetchone()[0], 0)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM students').fetchone()[0], 2)
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])


if __name__ == '__main__':
    unittest.main(verbosity=2)

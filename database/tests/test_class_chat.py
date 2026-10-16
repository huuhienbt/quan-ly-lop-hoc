"""Class chat identity, thread and moderation integrity in isolated SQLite."""
import sqlite3
import unittest
from pathlib import Path


class ClassChatSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        for path in sorted((Path(__file__).resolve().parents[1] / 'migrations').glob('*.sql')):
            self.db.executescript(path.read_text(encoding='utf-8'))
        self.db.executescript("""
          INSERT INTO users (id,email,name,role) VALUES ('chat-teacher','chat@example.invalid','Synthetic teacher','SUPER_ADMIN');
          INSERT INTO academic_years (id,school_id,name,starts_on,ends_on)
            VALUES ('chat-year','school-ben-tre','Chat year','2026-09-01','2027-05-31');
          INSERT INTO classes (id,school_id,academic_year_id,name,slug,grade,created_by) VALUES
            ('chat-a','school-ben-tre','chat-year','Chat A','chat-a',4,'chat-teacher'),
            ('chat-b','school-ben-tre','chat-year','Chat B','chat-b',4,'chat-teacher');
          INSERT INTO students (id,school_id,full_name) VALUES
            ('chat-pupil-a','school-ben-tre','Synthetic pupil A'),
            ('chat-pupil-b','school-ben-tre','Synthetic pupil B');
          INSERT INTO student_enrollments (id,student_id,class_id,school_id,academic_year_id,enrolled_on) VALUES
            ('chat-enrollment-a','chat-pupil-a','chat-a','school-ben-tre','chat-year','2026-09-01'),
            ('chat-enrollment-b','chat-pupil-b','chat-b','school-ben-tre','chat-year','2026-09-01');
          INSERT INTO student_accounts (id,phone,password_hash) VALUES
            ('chat-account-a','0900000001','scrypt$16384$8$1$' || printf('%032d', 0) || '$' || printf('%0128d', 0)),
            ('chat-account-b','0900000002','scrypt$16384$8$1$' || printf('%032d', 0) || '$' || printf('%0128d', 0));
          INSERT INTO student_account_students (account_id,student_id) VALUES
            ('chat-account-a','chat-pupil-a'), ('chat-account-b','chat-pupil-b');
        """)

    def message(self, **changes):
        values = dict(id='chat-message', class_id='chat-a', thread_enrollment_id=None,
                      sender_kind='STUDENT', sender_user_id=None, sender_account_id='chat-account-a',
                      sender_enrollment_id='chat-enrollment-a', client_message_id='12345678-1234-4234-9234-123456789012', body='Synthetic hello')
        values.update(changes)
        self.db.execute(f"INSERT INTO class_chat_messages ({','.join(values)}) VALUES ({','.join('?' for _ in values)})", tuple(values.values()))

    def reject(self, **changes):
        with self.assertRaises(sqlite3.IntegrityError):
            self.message(**changes)

    def test_migration_does_not_seed_messages_or_change_whisper_inbox(self):
        self.assertEqual(self.db.execute('SELECT count(*) FROM class_chat_messages').fetchone()[0], 0)
        self.assertEqual(self.db.execute('SELECT count(*) FROM messages').fetchone()[0], 0)

    def test_sender_identity_is_exclusive_and_complete(self):
        for changes in [dict(sender_kind='ADMIN'), dict(sender_account_id=None), dict(sender_enrollment_id=None),
                        dict(sender_user_id='chat-teacher'), dict(sender_kind='TEACHER'),
                        dict(sender_kind='TEACHER', sender_user_id='chat-teacher', sender_enrollment_id=None)]:
            with self.subTest(changes=changes): self.reject(**changes)
        self.message(sender_kind='TEACHER', sender_user_id='chat-teacher', sender_account_id=None, sender_enrollment_id=None)

    def test_private_thread_and_student_sender_belong_to_the_message_class(self):
        for changes in [dict(thread_enrollment_id='chat-enrollment-b'), dict(sender_enrollment_id='chat-enrollment-b'),
                        dict(class_id='chat-b'), dict(thread_enrollment_id='missing')]:
            with self.subTest(changes=changes): self.reject(**changes)
        self.message(thread_enrollment_id='chat-enrollment-a')

    def test_account_must_be_linked_to_the_sending_pupil(self):
        self.reject(sender_account_id='chat-account-b')
        self.db.execute("UPDATE student_account_students SET account_id='chat-account-b' WHERE student_id='chat-pupil-a'")
        self.message(sender_account_id='chat-account-b')

    def test_student_cannot_start_a_peer_private_thread_even_within_the_same_class(self):
        self.db.execute("INSERT INTO students (id,school_id,full_name) VALUES ('chat-peer','school-ben-tre','Synthetic peer')")
        self.db.execute("""INSERT INTO student_enrollments (id,student_id,class_id,school_id,academic_year_id,enrolled_on)
          VALUES ('chat-peer-enrollment','chat-peer','chat-a','school-ben-tre','chat-year','2026-09-01')""")
        self.reject(thread_enrollment_id='chat-peer-enrollment')

    def test_actor_key_is_derived_and_retry_keys_are_unique_per_login_actor(self):
        self.message()
        self.assertEqual(self.db.execute('SELECT actor_key FROM class_chat_messages').fetchone()[0], 'student:chat-account-a')
        self.reject(id='retry')
        self.message(id='independent', sender_kind='TEACHER', sender_user_id='chat-teacher', sender_account_id=None, sender_enrollment_id=None)

    def test_empty_oversized_and_null_character_messages_are_rejected(self):
        for body in ['', '   ', 'x' * 2001, 'bad\x00value']:
            with self.subTest(body_length=len(body)): self.reject(body=body)

    def test_messages_are_immutable_but_one_way_staff_moderation_is_allowed(self):
        self.message()
        for change in ["body='changed'", "class_id='chat-b'", "sender_user_id='chat-teacher'", "client_message_id='changed'", "created_at='2026-01-01'"]:
            with self.subTest(change=change), self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(f"UPDATE class_chat_messages SET {change}")
        self.db.execute("UPDATE class_chat_messages SET hidden_at='2026-10-16',hidden_by='chat-teacher'")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute('UPDATE class_chat_messages SET hidden_at=NULL,hidden_by=NULL')
        self.assertEqual(self.db.execute('SELECT body FROM class_chat_messages').fetchone()[0], 'Synthetic hello')

    def test_hide_requires_both_timestamp_and_staff_identity(self):
        self.message()
        for change in ["hidden_at='2026-10-16'", "hidden_by='chat-teacher'", "hidden_at='2026-10-16',hidden_by='missing'"]:
            with self.subTest(change=change), self.assertRaises(sqlite3.IntegrityError):
                self.db.execute(f'UPDATE class_chat_messages SET {change}')

    def test_history_restricts_account_and_pupil_hard_delete(self):
        self.message()
        for sql in ["DELETE FROM student_accounts WHERE id='chat-account-a'", "DELETE FROM student_enrollments WHERE id='chat-enrollment-a'", "DELETE FROM classes WHERE id='chat-a'"]:
            with self.subTest(sql=sql), self.assertRaises(sqlite3.IntegrityError): self.db.execute(sql)
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])


if __name__ == '__main__':
    unittest.main(verbosity=2)

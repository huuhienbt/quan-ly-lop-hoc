"""Kiểm thử ràng buộc dữ liệu thực tế, không cần tài khoản Cloudflare."""

import sqlite3
import unittest
from pathlib import Path


SCHEMA = Path(__file__).resolve().parents[1] / 'migrations' / '0001_initial.sql'


class SchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        self.db.executescript(SCHEMA.read_text(encoding='utf-8'))
        self.db.executescript("""
          INSERT INTO schools (id, name, slug) VALUES ('school-2', 'Trường khác', 'truong-khac');
          INSERT INTO users (id, email, name, role) VALUES
            ('admin', 'admin@example.com', 'Quản trị', 'SUPER_ADMIN'),
            ('teacher', 'teacher@example.com', 'GVCN', 'TEACHER'),
            ('teacher-2', 'teacher2@example.com', 'GVCN 2', 'TEACHER'),
            ('pending', 'pending@example.com', 'Chờ duyệt', 'PENDING');
          INSERT INTO academic_years (id, school_id, name, starts_on, ends_on, is_current) VALUES
            ('year-1', 'school-ben-tre', '2026-2027', '2026-09-01', '2027-05-31', 1),
            ('year-2', 'school-2', '2026-2027', '2026-09-01', '2027-05-31', 1);
          INSERT INTO classes (id, school_id, academic_year_id, name, slug, grade, created_by) VALUES
            ('class-1', 'school-ben-tre', 'year-1', 'Bốn 12', 'bon-12-2026-2027', 4, 'admin'),
            ('class-2', 'school-ben-tre', 'year-1', 'Bốn 13', 'bon-13-2026-2027', 4, 'admin'),
            ('class-3', 'school-2', 'year-2', 'Bốn 12', 'truong-khac-bon-12', 4, 'admin');
          INSERT INTO class_teachers (class_id, user_id, assigned_by) VALUES ('class-1', 'teacher', 'admin');
          INSERT INTO students (id, school_id, full_name, date_of_birth) VALUES
            ('student-1', 'school-ben-tre', 'Học sinh một', '2016-10-13'),
            ('student-2', 'school-ben-tre', 'Học sinh hai', NULL),
            ('student-3', 'school-2', 'Học sinh ba', NULL);
          INSERT INTO student_enrollments (id, student_id, class_id, school_id, academic_year_id, enrolled_on) VALUES
            ('enrollment-1', 'student-1', 'class-1', 'school-ben-tre', 'year-1', '2026-09-01'),
            ('enrollment-2', 'student-2', 'class-2', 'school-ben-tre', 'year-1', '2026-09-01'),
            ('enrollment-3', 'student-3', 'class-3', 'school-2', 'year-2', '2026-09-01');
        """)

    def reject(self, sql, params=()):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(sql, params)

    def star(self, id='star-1', delta=5, enrollment='enrollment-1', class_id='class-1', reverses=None, key=None):
        self.db.execute(
            'INSERT INTO stars (id, class_id, enrollment_id, delta, reason, awarded_by, reverses_id, idempotency_key) '
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            (id, class_id, enrollment, delta, 'Giúp bạn', 'teacher', reverses, key or id),
        )

    def media(self):
        self.db.executescript("""
          INSERT INTO media_assets (id, class_id, uploaded_by, url, mime_type) VALUES
            ('asset-1', 'class-1', 'teacher', 'https://example.com/1.jpg', 'image/jpeg'),
            ('asset-2', 'class-2', 'teacher-2', 'https://example.com/2.jpg', 'image/jpeg');
          INSERT INTO albums (id, class_id, title, created_by) VALUES
            ('album-1', 'class-1', 'Trung thu', 'teacher');
          INSERT INTO photos (id, class_id, album_id, asset_id, added_by) VALUES
            ('photo-1', 'class-1', 'album-1', 'asset-1', 'teacher');
        """)

    def test_all_tables_and_seed_exist(self):
        self.assertEqual(self.db.execute("SELECT count(*) FROM sqlite_master WHERE type='table'").fetchone()[0], 24)
        self.assertEqual(self.db.execute("SELECT name FROM schools WHERE id='school-ben-tre'").fetchone()[0], 'Trường Tiểu học Bến Tre')
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_google_identity_unique_and_email_case_insensitive(self):
        self.db.execute("INSERT INTO accounts (provider_account_id, user_id) VALUES ('google-sub-1', 'teacher')")
        self.reject("INSERT INTO accounts (provider_account_id, user_id) VALUES ('google-sub-1', 'pending')")
        self.reject("INSERT INTO users (id, email, name) VALUES ('duplicate', 'TEACHER@EXAMPLE.COM', 'Trùng')")

    def test_unapproved_teacher_cannot_be_assigned(self):
        self.reject("INSERT INTO class_teachers (class_id, user_id, assigned_by) VALUES ('class-2', 'pending', 'admin')")

    def test_one_homeroom_teacher(self):
        self.reject("INSERT INTO class_teachers (class_id, user_id, assigned_by) VALUES ('class-1', 'teacher-2', 'admin')")
        self.db.execute("UPDATE class_teachers SET ended_at='2026-10-13T00:00:00Z' WHERE user_id='teacher'")
        self.db.execute("INSERT INTO class_teachers (class_id, user_id, assigned_by) VALUES ('class-1', 'teacher-2', 'admin')")

    def test_suspension_ends_assignment(self):
        self.db.execute("UPDATE users SET status='SUSPENDED' WHERE id='teacher'")
        self.assertIsNotNone(self.db.execute("SELECT ended_at FROM class_teachers WHERE user_id='teacher'").fetchone()[0])
        self.db.execute("UPDATE users SET status='ACTIVE' WHERE id='teacher'")
        self.assertIsNotNone(self.db.execute("SELECT ended_at FROM class_teachers WHERE user_id='teacher'").fetchone()[0])

    def test_one_current_academic_year(self):
        self.reject("INSERT INTO academic_years (id, school_id, name, starts_on, ends_on, is_current) VALUES ('future', 'school-ben-tre', '2027-2028', '2027-09-01', '2028-05-31', 1)")

    def test_invalid_dates_rejected(self):
        self.reject("UPDATE students SET date_of_birth='2016-02-30' WHERE id='student-1'")
        self.reject("UPDATE academic_years SET starts_on='not-a-date' WHERE id='year-1'")

    def test_enrollment_cannot_cross_school(self):
        self.reject("INSERT INTO student_enrollments (id, student_id, class_id, school_id, academic_year_id, enrolled_on) VALUES ('bad', 'student-3', 'class-1', 'school-ben-tre', 'year-1', '2026-09-01')")

    def test_one_active_class_per_student_per_year(self):
        self.reject("INSERT INTO student_enrollments (id, student_id, class_id, school_id, academic_year_id, enrolled_on) VALUES ('duplicate', 'student-1', 'class-2', 'school-ben-tre', 'year-1', '2026-09-01')")
        self.db.execute("UPDATE student_enrollments SET status='TRANSFERRED', ended_on='2026-10-13' WHERE id='enrollment-1'")
        self.db.execute("INSERT INTO student_enrollments (id, student_id, class_id, school_id, academic_year_id, enrolled_on) VALUES ('new', 'student-1', 'class-2', 'school-ben-tre', 'year-1', '2026-10-13')")

    def test_enrollment_cannot_use_wrong_year(self):
        self.reject("UPDATE student_enrollments SET academic_year_id='year-2' WHERE id='enrollment-1'")

    def test_stars_sum_and_reversal(self):
        self.star(delta=5)
        self.star('star-2', delta=3)
        self.star('reversal', delta=-5, reverses='star-1')
        self.assertEqual(self.db.execute("SELECT total_stars FROM student_star_balances WHERE enrollment_id='enrollment-1'").fetchone()[0], 3)
        self.assertEqual(self.db.execute("SELECT total_stars FROM student_star_balances WHERE enrollment_id='enrollment-2'").fetchone()[0], 0)

    def test_stars_cannot_cross_class(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.star(class_id='class-2')

    def test_stars_cannot_be_negative(self):
        self.star()
        with self.assertRaises(sqlite3.IntegrityError):
            self.star('subtract', delta=-6)

    def test_star_reversal_must_match_original(self):
        self.star()
        with self.assertRaises(sqlite3.IntegrityError):
            self.star('bad-reversal', delta=-3, reverses='star-1')

    def test_star_ledger_cannot_update_or_delete(self):
        self.star()
        self.reject("UPDATE stars SET delta=1 WHERE id='star-1'")
        self.reject("DELETE FROM stars WHERE id='star-1'")

    def test_star_ledger_cannot_replace_existing_row(self):
        self.star()
        self.reject("INSERT OR REPLACE INTO stars (id, class_id, enrollment_id, delta, reason, awarded_by, idempotency_key) VALUES ('star-1', 'class-1', 'enrollment-1', -1, 'Thử ghi đè', 'teacher', 'star-1')")
        self.assertEqual(self.db.execute("SELECT delta FROM stars WHERE id='star-1'").fetchone()[0], 5)

    def test_star_idempotency(self):
        self.star(key='request-1')
        with self.assertRaises(sqlite3.IntegrityError):
            self.star('different-id', key='request-1')

    def test_mood_one_per_local_day(self):
        sql = 'INSERT INTO moods (id, class_id, enrollment_id, local_date, mood) VALUES (?, ?, ?, ?, ?)'
        self.db.execute(sql, ('mood-1', 'class-1', 'enrollment-1', '2026-10-13', 'HAPPY'))
        self.reject(sql, ('mood-2', 'class-1', 'enrollment-1', '2026-10-13', 'SAD'))
        self.reject(sql, ('mood-3', 'class-2', 'enrollment-1', '2026-10-14', 'HAPPY'))
        self.reject(sql, ('mood-4', 'class-1', 'enrollment-1', '2026-02-30', 'HAPPY'))

    def test_anonymous_mail_has_no_identity(self):
        self.db.execute("INSERT INTO messages (id, class_id, sender_kind, body) VALUES ('anonymous', 'class-1', 'STUDENT', 'Em muốn tâm sự')")
        for field, value in [('sender_user_id', 'teacher'), ('sender_enrollment_id', 'enrollment-1'), ('sender_name', 'Tên thật'), ('sender_contact', 'contact')]:
            with self.subTest(field=field):
                self.reject(f'UPDATE messages SET {field}=? WHERE id=?', (value, 'anonymous'))

    def test_named_mail_needs_identity_and_reply_needs_author(self):
        self.reject("INSERT INTO messages (id, class_id, sender_kind, is_anonymous, body) VALUES ('bad', 'class-1', 'PARENT', 0, 'Xin góp ý')")
        self.db.execute("INSERT INTO messages (id, class_id, sender_kind, is_anonymous, sender_name, body) VALUES ('named', 'class-1', 'PARENT', 0, 'Phụ huynh', 'Xin góp ý')")
        self.reject("UPDATE messages SET status='REPLIED' WHERE id='named'")

    def test_gratitude_moderation_and_class_scope(self):
        self.db.execute("INSERT INTO gratitudes (id, class_id, author_name, recipient_enrollment_id, body) VALUES ('thanks', 'class-1', 'Phụ huynh', 'enrollment-1', 'Cảm ơn em')")
        self.reject("UPDATE gratitudes SET status='APPROVED' WHERE id='thanks'")
        self.reject("UPDATE gratitudes SET recipient_enrollment_id='enrollment-2' WHERE id='thanks'")
        self.db.execute("UPDATE gratitudes SET status='APPROVED', moderated_by='teacher', moderated_at='2026-10-13T00:00:00Z' WHERE id='thanks'")

    def test_teacher_review_metadata_required(self):
        self.db.execute("INSERT INTO teacher_requests (id, user_id, school_id) VALUES ('request', 'pending', 'school-ben-tre')")
        self.reject("UPDATE teacher_requests SET status='APPROVED' WHERE id='request'")

    def test_media_cannot_cross_class(self):
        self.media()
        self.db.execute("INSERT INTO posts (id, class_id, author_id, title, body) VALUES ('post', 'class-1', 'teacher', 'Thông báo', 'Nội dung')")
        self.reject("INSERT INTO post_media (post_id, asset_id, class_id) VALUES ('post', 'asset-2', 'class-1')")
        self.reject("INSERT INTO photos (id, class_id, album_id, asset_id, added_by) VALUES ('bad', 'class-1', 'album-1', 'asset-2', 'teacher')")

    def test_photo_like_identity_and_duplicates(self):
        self.media()
        self.db.execute("INSERT INTO photo_likes (id, photo_id, user_id) VALUES ('like-1', 'photo-1', 'teacher')")
        self.reject("INSERT INTO photo_likes (id, photo_id, user_id) VALUES ('like-2', 'photo-1', 'teacher')")
        self.reject("INSERT INTO photo_likes (id, photo_id) VALUES ('no-identity', 'photo-1')")
        self.reject("INSERT INTO photo_likes (id, photo_id, user_id, visitor_token_hash) VALUES ('both', 'photo-1', 'teacher', ?)", ('a' * 64,))
        self.db.execute("INSERT INTO photo_likes (id, photo_id, visitor_token_hash) VALUES ('guest', 'photo-1', ?)", ('a' * 64,))
        self.reject("INSERT INTO photo_likes (id, photo_id, visitor_token_hash) VALUES ('duplicate-guest', 'photo-1', ?)", ('a' * 64,))

    def test_group_members_are_unique_and_in_same_class(self):
        self.db.executescript("""
          INSERT INTO group_sessions (id, class_id, group_count, created_by) VALUES ('session', 'class-1', 2, 'teacher');
          INSERT INTO student_groups (id, session_id, class_id, group_number) VALUES
            ('group-1', 'session', 'class-1', 1), ('group-2', 'session', 'class-1', 2);
          INSERT INTO group_members (group_id, session_id, class_id, enrollment_id) VALUES
            ('group-1', 'session', 'class-1', 'enrollment-1');
        """)
        self.reject("INSERT INTO group_members (group_id, session_id, class_id, enrollment_id) VALUES ('group-2', 'session', 'class-1', 'enrollment-1')")
        self.reject("INSERT INTO group_members (group_id, session_id, class_id, enrollment_id) VALUES ('group-2', 'session', 'class-1', 'enrollment-2')")

    def test_wheel_draw_cannot_cross_class(self):
        self.reject("INSERT INTO wheel_draws (id, class_id, enrollment_id, drawn_by) VALUES ('bad', 'class-1', 'enrollment-2', 'teacher')")

    def test_class_and_student_history_cannot_be_deleted(self):
        self.reject("DELETE FROM classes WHERE id='class-1'")
        self.reject("DELETE FROM students WHERE id='student-1'")


if __name__ == '__main__':
    unittest.main(verbosity=2)

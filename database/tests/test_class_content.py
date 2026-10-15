"""Migration-specific editorial and daily-checklist integrity checks."""

import sqlite3
import unittest
from pathlib import Path


MIGRATIONS = Path(__file__).resolve().parents[1] / 'migrations'


class ClassContentSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        self.db.executescript((MIGRATIONS / '0001_initial.sql').read_text(encoding='utf-8'))
        self.db.executescript((MIGRATIONS / '0002_student_accounts.sql').read_text(encoding='utf-8'))
        self.db.executescript("""
          INSERT INTO users (id, email, name, role) VALUES
            ('editor', 'editor@example.invalid', 'Fixture editor', 'SUPER_ADMIN');
          INSERT INTO academic_years (id, school_id, name, starts_on, ends_on) VALUES
            ('year', 'school-ben-tre', '2026-2027', '2026-09-01', '2027-05-31');
          INSERT INTO classes (id, school_id, academic_year_id, name, slug, grade, created_by) VALUES
            ('class-a', 'school-ben-tre', 'year', 'Fixture A', 'fixture-a', 4, 'editor'),
            ('class-b', 'school-ben-tre', 'year', 'Fixture B', 'fixture-b', 4, 'editor');
          INSERT INTO students (id, school_id, full_name) VALUES
            ('student-a', 'school-ben-tre', 'Fixture pupil A'),
            ('student-b', 'school-ben-tre', 'Fixture pupil B'),
            ('student-c', 'school-ben-tre', 'Fixture pupil C');
          INSERT INTO student_enrollments
            (id, student_id, class_id, school_id, academic_year_id, enrolled_on) VALUES
            ('enrollment-a', 'student-a', 'class-a', 'school-ben-tre', 'year', '2026-09-01'),
            ('enrollment-b', 'student-b', 'class-b', 'school-ben-tre', 'year', '2026-09-01'),
            ('enrollment-c', 'student-c', 'class-a', 'school-ben-tre', 'year', '2026-09-01');
          INSERT INTO posts (id, class_id, author_id, title, body) VALUES
            ('legacy-post', 'class-a', 'editor', 'Existing title', 'Existing body');
        """)
        self.db.executescript((MIGRATIONS / '0003_class_content.sql').read_text(encoding='utf-8'))

    def reject(self, sql, params=()):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(sql, params)

    def event(self, event_id='event', class_id='class-a', event_date='2026-10-15', starts_at=None):
        self.db.execute(
            'INSERT INTO class_events (id, class_id, title, event_date, starts_at, created_by) '
            'VALUES (?, ?, ?, ?, ?, ?)',
            (event_id, class_id, 'Fixture event', event_date, starts_at, 'editor'),
        )

    def task(self, task_id='task-a', class_id='class-a', kind='TODO', task_date=None):
        self.db.execute(
            'INSERT INTO class_tasks (id, class_id, title, kind, task_date, created_by) VALUES (?, ?, ?, ?, ?, ?)',
            (task_id, class_id, 'Fixture task', kind, task_date, 'editor'),
        )

    def complete(self, task_id='task-a', enrollment='enrollment-a', class_id='class-a', day='2026-10-15'):
        self.db.execute(
            'INSERT INTO student_task_completions (task_id, enrollment_id, class_id, completion_date) '
            'VALUES (?, ?, ?, ?)',
            (task_id, enrollment, class_id, day),
        )

    def test_existing_posts_receive_safe_category_default(self):
        self.assertEqual(self.db.execute(
            "SELECT title, body, category, cover_url, status, visibility FROM posts WHERE id = 'legacy-post'"
        ).fetchone(), ('Existing title', 'Existing body', 'GENERAL', None, 'DRAFT', 'PRIVATE'))

    def test_post_category_is_restricted(self):
        for category in ('GENERAL', 'CLASS_STORY', 'KINDNESS', 'PARENT_GUIDE', 'DISCOVERY'):
            self.db.execute("UPDATE posts SET category = ? WHERE id = 'legacy-post'", (category,))
        for category in ('', 'general', 'UNKNOWN', None):
            with self.subTest(category=category):
                self.reject("UPDATE posts SET category = ? WHERE id = 'legacy-post'", (category,))

    def test_event_is_private_draft_by_default(self):
        self.event()
        self.assertEqual(self.db.execute('SELECT status, visibility, starts_at FROM class_events').fetchone(),
                         ('DRAFT', 'PRIVATE', None))

    def test_event_calendar_date_must_exist_and_be_iso(self):
        self.event(event_date='2028-02-29')
        for date in ('2026-02-29', '2026-02-30', '2026-13-01', '2026-10-1', '15/10/2026', '2026-10-15T00:00:00Z', ''):
            with self.subTest(date=date):
                self.reject('UPDATE class_events SET event_date = ?', (date,))

    def test_event_start_time_uses_24_hour_clock(self):
        self.event()
        for value in (None, '00:00', '09:05', '23:59'):
            self.db.execute('UPDATE class_events SET starts_at = ?', (value,))
        for value in ('24:00', '29:10', '12:60', '9:00', '09:0', '09:00:00', ''):
            with self.subTest(time=value):
                self.reject('UPDATE class_events SET starts_at = ?', (value,))

    def test_event_publication_flags_and_required_foreign_keys(self):
        self.event()
        for field, value in (('status', 'UNKNOWN'), ('visibility', 'UNLISTED'), ('title', '  '),
                             ('class_id', 'missing-class'), ('created_by', 'missing-user')):
            with self.subTest(field=field):
                self.reject(f'UPDATE class_events SET {field} = ?', (value,))

    def test_tasks_support_recurring_and_date_specific_schedules(self):
        self.task()
        self.task('preparation', kind='PREPARATION', task_date='2026-10-16')
        self.assertEqual(self.db.execute(
            "SELECT kind, task_date, status, sort_order FROM class_tasks WHERE id = 'task-a'"
        ).fetchone(), ('TODO', None, 'PUBLISHED', 0))
        self.assertEqual(self.db.execute(
            "SELECT kind, task_date FROM class_tasks WHERE id = 'preparation'"
        ).fetchone(), ('PREPARATION', '2026-10-16'))

    def test_task_date_and_metadata_are_validated(self):
        self.task()
        invalid = (
            ('task_date', '2026-02-29'), ('task_date', '2026-04-31'), ('task_date', 'tomorrow'),
            ('kind', 'HOMEWORK'), ('status', 'DRAFT'), ('title', '  '),
            ('sort_order', -1), ('sort_order', 1.5),
            ('class_id', 'missing-class'), ('created_by', 'missing-user'),
        )
        for field, value in invalid:
            with self.subTest(field=field, value=value):
                self.reject(f'UPDATE class_tasks SET {field} = ?', (value,))

    def test_completion_is_unique_per_task_pupil_and_day(self):
        self.task()
        self.complete()
        self.reject('''INSERT INTO student_task_completions
            (task_id, enrollment_id, class_id, completion_date)
            VALUES ('task-a', 'enrollment-a', 'class-a', '2026-10-15')''')
        self.complete(day='2026-10-16')
        self.complete(enrollment='enrollment-c')
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM student_task_completions').fetchone()[0], 3)

    def test_completion_cannot_cross_class(self):
        self.task()
        self.task('task-b', 'class-b')
        invalid = (
            ('task-a', 'enrollment-b', 'class-a'),
            ('task-a', 'enrollment-a', 'class-b'),
            ('task-b', 'enrollment-a', 'class-b'),
        )
        for task, enrollment, class_id in invalid:
            with self.subTest(task=task, enrollment=enrollment, class_id=class_id):
                self.reject('''INSERT INTO student_task_completions
                    (task_id, enrollment_id, class_id, completion_date) VALUES (?, ?, ?, ?)''',
                    (task, enrollment, class_id, '2026-10-15'))
        self.complete()
        self.reject("UPDATE student_task_completions SET class_id = 'class-b'")

    def test_completion_requires_real_task_enrollment_and_calendar_day(self):
        self.task()
        for task, enrollment, day in (
            ('missing-task', 'enrollment-a', '2026-10-15'),
            ('task-a', 'missing-enrollment', '2026-10-15'),
            ('task-a', 'enrollment-a', '2026-02-30'),
            ('task-a', 'enrollment-a', '2026-10-15T00:00:00Z'),
        ):
            with self.subTest(task=task, enrollment=enrollment, day=day):
                self.reject('''INSERT INTO student_task_completions
                    (task_id, enrollment_id, class_id, completion_date) VALUES (?, ?, ?, ?)''',
                    (task, enrollment, 'class-a', day))

    def test_preparation_for_tomorrow_can_be_completed_today(self):
        self.task(kind='PREPARATION', task_date='2026-10-16')
        self.complete(day='2026-10-15')
        self.assertEqual(self.db.execute('SELECT completion_date FROM student_task_completions').fetchone()[0], '2026-10-15')

    def test_archiving_keeps_completion_history_and_hard_delete_is_restricted(self):
        self.task()
        self.complete()
        self.db.execute("UPDATE class_tasks SET status = 'ARCHIVED' WHERE id = 'task-a'")
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM student_task_completions').fetchone()[0], 1)
        self.reject("DELETE FROM class_tasks WHERE id = 'task-a'")
        self.reject("DELETE FROM student_enrollments WHERE id = 'enrollment-a'")
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])


if __name__ == '__main__':
    unittest.main(verbosity=2)

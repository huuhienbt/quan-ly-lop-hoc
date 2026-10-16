"""Timetable snapshot and pupil check integrity in an isolated SQLite database."""

import sqlite3
import unittest
from pathlib import Path


class ClassTimetableSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        for migration in sorted((Path(__file__).resolve().parents[1] / 'migrations').glob('*.sql')):
            self.db.executescript(migration.read_text(encoding='utf-8'))
        self.db.executescript("""
          INSERT INTO users (id, email, name, role) VALUES
            ('schedule-editor', 'schedule@example.invalid', 'Synthetic schedule editor', 'SUPER_ADMIN');
          INSERT INTO academic_years (id, school_id, name, starts_on, ends_on) VALUES
            ('schedule-year', 'school-ben-tre', 'Schedule fixture year', '2026-09-01', '2027-05-31');
          INSERT INTO classes (id, school_id, academic_year_id, name, slug, grade, created_by) VALUES
            ('schedule-a', 'school-ben-tre', 'schedule-year', 'Fixture A', 'schedule-a', 4, 'schedule-editor'),
            ('schedule-b', 'school-ben-tre', 'schedule-year', 'Fixture B', 'schedule-b', 4, 'schedule-editor');
          INSERT INTO students (id, school_id, full_name) VALUES
            ('schedule-pupil-a', 'school-ben-tre', 'Synthetic pupil A'),
            ('schedule-pupil-b', 'school-ben-tre', 'Synthetic pupil B');
          INSERT INTO student_enrollments
            (id, student_id, class_id, school_id, academic_year_id, enrolled_on) VALUES
            ('schedule-enrollment-a', 'schedule-pupil-a', 'schedule-a', 'school-ben-tre', 'schedule-year', '2026-09-01'),
            ('schedule-enrollment-b', 'schedule-pupil-b', 'schedule-b', 'school-ben-tre', 'schedule-year', '2026-09-01');
          INSERT INTO class_timetable_versions (id, class_id, revision, effective_from, created_by) VALUES
            ('snapshot-a', 'schedule-a', 1, '2026-09-28', 'schedule-editor'),
            ('snapshot-b', 'schedule-b', 1, '2026-09-28', 'schedule-editor');
        """)
        self.lesson()

    def reject(self, sql, parameters=()):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(sql, parameters)

    def lesson(self, lesson_id='lesson-a', **overrides):
        data = dict(class_id='schedule-a', version_id='snapshot-a', weekday=1,
                    session='MORNING', starts_at='07:20', ends_at='07:55',
                    subject='Tiếng Việt', subject_key='tiếng việt', instructor='', todo='', preparation='')
        data.update(overrides)
        self.db.execute('''INSERT INTO class_timetable_lessons
          (id, class_id, version_id, weekday, session, starts_at, ends_at,
           subject, subject_key, instructor, todo, preparation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                        (lesson_id, *data.values()))

    def complete(self, **overrides):
        values = dict(lesson_id='lesson-a', enrollment_id='schedule-enrollment-a',
                      class_id='schedule-a', kind='PREPARATION', lesson_date='2026-10-19')
        values.update(overrides)
        self.db.execute('''INSERT INTO student_timetable_checks
          (lesson_id, enrollment_id, class_id, kind, lesson_date) VALUES (?, ?, ?, ?, ?)''', tuple(values.values()))

    def test_migration_does_not_create_or_replace_real_timetables(self):
        self.assertEqual(self.db.execute('SELECT count(*) FROM class_timetable_settings').fetchone()[0], 0)
        self.assertEqual(self.db.execute('SELECT count(*) FROM student_timetable_checks').fetchone()[0], 0)

    def test_revision_is_a_unique_positive_integer_per_class(self):
        for revision in (0, -1, 1.5, 1):
            with self.subTest(revision=revision):
                self.reject('''INSERT INTO class_timetable_versions
                  (id, class_id, revision, effective_from, created_by)
                  VALUES ('other-snapshot', 'schedule-a', ?, '2026-10-01', 'schedule-editor')''', (revision,))
        self.db.execute('''INSERT INTO class_timetable_versions
          (id, class_id, revision, effective_from, created_by)
          VALUES ('new-snapshot', 'schedule-a', 2, '2026-10-01', 'schedule-editor')''')

    def test_version_dates_exist_and_use_calendar_date_format(self):
        for day in ('2026-02-29', '2026-02-30', '2026-13-01', '2026-9-28', '28/09/2026', ''):
            with self.subTest(day=day):
                self.reject('''INSERT INTO class_timetable_versions
                  (id, class_id, revision, effective_from, created_by)
                  VALUES ('bad-date', 'schedule-a', 2, ?, 'schedule-editor')''', (day,))

    def test_saved_snapshots_and_lesson_contents_cannot_be_modified(self):
        self.reject("UPDATE class_timetable_versions SET effective_from = '2026-10-01' WHERE id = 'snapshot-a'")
        self.reject("UPDATE class_timetable_lessons SET subject = 'Modified' WHERE id = 'lesson-a'")
        self.assertEqual(self.db.execute("SELECT subject FROM class_timetable_lessons WHERE id = 'lesson-a'").fetchone()[0], 'Tiếng Việt')

    def test_lesson_requires_matching_snapshot_class(self):
        for class_id, version_id in (('schedule-b', 'snapshot-a'), ('schedule-a', 'snapshot-b'), ('schedule-a', 'missing')):
            with self.subTest(class_id=class_id, version_id=version_id):
                with self.assertRaises(sqlite3.IntegrityError):
                    self.lesson('cross-class', class_id=class_id, version_id=version_id, weekday=2)

    def test_lesson_day_time_session_and_subject_are_validated(self):
        invalid = [dict(weekday=0), dict(weekday=8), dict(weekday=1.5), dict(session='EVENING'),
                   dict(starts_at='7:20'), dict(starts_at='24:00'), dict(ends_at='07:20'),
                   dict(ends_at='07:19'), dict(ends_at='07:60'), dict(subject='  '),
                   dict(session='AFTERNOON'), dict(starts_at='11:50', ends_at='12:10')]
        for overrides in invalid:
            with self.subTest(overrides=overrides):
                with self.assertRaises(sqlite3.IntegrityError):
                    self.lesson('bad-lesson', **overrides)

    def test_overlap_is_rejected_but_adjacent_periods_and_another_day_are_allowed(self):
        for starts_at, ends_at in [('07:25', '07:40'), ('07:00', '07:30'), ('07:50', '08:10')]:
            with self.subTest(starts_at=starts_at, ends_at=ends_at):
                with self.assertRaises(sqlite3.IntegrityError):
                    self.lesson('overlap', starts_at=starts_at, ends_at=ends_at)
        self.lesson('adjacent', starts_at='07:55', ends_at='08:30')
        self.lesson('next-day', weekday=2)

    def test_completion_cannot_cross_class_even_when_both_records_exist(self):
        self.lesson('lesson-b', class_id='schedule-b', version_id='snapshot-b')
        for overrides in [dict(enrollment_id='schedule-enrollment-b'), dict(class_id='schedule-b'),
                          dict(lesson_id='lesson-b'), dict(lesson_id='missing'), dict(enrollment_id='missing')]:
            with self.subTest(overrides=overrides):
                with self.assertRaises(sqlite3.IntegrityError):
                    self.complete(**overrides)

    def test_completion_is_unique_by_lesson_pupil_kind_and_target_teaching_day(self):
        self.complete()
        with self.assertRaises(sqlite3.IntegrityError):
            self.complete()
        self.complete(kind='TODO')
        self.complete(lesson_date='2026-10-26')
        self.assertEqual(self.db.execute('SELECT count(*) FROM student_timetable_checks').fetchone()[0], 3)

    def test_completion_kind_and_calendar_day_are_validated(self):
        for overrides in [dict(kind='HOMEWORK'), dict(kind='preparation'), dict(lesson_date='2026-02-29'),
                          dict(lesson_date='2026-10-19T00:00:00Z'), dict(lesson_date='tomorrow')]:
            with self.subTest(overrides=overrides):
                with self.assertRaises(sqlite3.IntegrityError):
                    self.complete(**overrides)

    def test_check_history_restricts_hard_delete_and_keeps_foreign_keys_valid(self):
        self.complete()
        self.reject("DELETE FROM class_timetable_lessons WHERE id = 'lesson-a'")
        self.reject("DELETE FROM class_timetable_versions WHERE id = 'snapshot-a'")
        self.reject("DELETE FROM student_enrollments WHERE id = 'schedule-enrollment-a'")
        self.assertEqual(self.db.execute('PRAGMA foreign_key_check').fetchall(), [])


if __name__ == '__main__':
    unittest.main(verbosity=2)

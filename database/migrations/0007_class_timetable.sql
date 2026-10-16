-- Full weekly snapshots: a new revision replaces the prior weekly schedule from
-- its effective date. Lessons and existing completion history are never edited.
CREATE TABLE class_timetable_settings (
  class_id TEXT PRIMARY KEY NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (typeof(revision) = 'integer' AND revision >= 0),
  write_token TEXT,
  updated_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE class_timetable_versions (
  id TEXT PRIMARY KEY NOT NULL,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (typeof(revision) = 'integer' AND revision > 0),
  effective_from TEXT NOT NULL CHECK (date(effective_from, '+0 days') IS NOT NULL AND date(effective_from, '+0 days') = effective_from),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (class_id, revision),
  UNIQUE (id, class_id)
);
CREATE INDEX idx_timetable_versions_applicable ON class_timetable_versions(class_id, revision DESC, effective_from);
CREATE TABLE class_timetable_lessons (
  id TEXT PRIMARY KEY NOT NULL,
  class_id TEXT NOT NULL,
  version_id TEXT NOT NULL,
  weekday INTEGER NOT NULL CHECK (typeof(weekday) = 'integer' AND weekday BETWEEN 1 AND 7),
  session TEXT NOT NULL CHECK (session IN ('MORNING', 'AFTERNOON')),
  starts_at TEXT NOT NULL CHECK (length(starts_at) = 5 AND starts_at GLOB '[0-2][0-9]:[0-5][0-9]' AND starts_at <= '23:59'),
  ends_at TEXT NOT NULL CHECK (length(ends_at) = 5 AND ends_at GLOB '[0-2][0-9]:[0-5][0-9]' AND ends_at <= '23:59' AND ends_at > starts_at),
  subject TEXT NOT NULL CHECK (length(trim(subject)) BETWEEN 1 AND 100),
  subject_key TEXT NOT NULL CHECK (length(trim(subject_key)) BETWEEN 1 AND 100),
  instructor TEXT NOT NULL DEFAULT '' CHECK (length(instructor) <= 100),
  todo TEXT NOT NULL DEFAULT '' CHECK (length(todo) <= 1000),
  preparation TEXT NOT NULL DEFAULT '' CHECK (length(preparation) <= 1000),
  FOREIGN KEY (version_id, class_id) REFERENCES class_timetable_versions(id, class_id) ON DELETE RESTRICT,
  UNIQUE (id, class_id),
  UNIQUE (version_id, weekday, starts_at),
  CHECK ((session = 'MORNING' AND ends_at <= '12:00') OR (session = 'AFTERNOON' AND starts_at >= '12:00'))
);
CREATE INDEX idx_timetable_lessons_day ON class_timetable_lessons(version_id, weekday, starts_at);
CREATE TRIGGER trg_timetable_no_lesson_overlap BEFORE INSERT ON class_timetable_lessons
WHEN EXISTS (SELECT 1 FROM class_timetable_lessons lesson WHERE lesson.version_id = NEW.version_id
  AND lesson.weekday = NEW.weekday AND lesson.starts_at < NEW.ends_at AND lesson.ends_at > NEW.starts_at)
BEGIN SELECT RAISE(ABORT, 'Timetable lessons may not overlap'); END;
CREATE TRIGGER trg_timetable_versions_immutable BEFORE UPDATE ON class_timetable_versions
BEGIN SELECT RAISE(ABORT, 'Create a new timetable revision instead'); END;
CREATE TRIGGER trg_timetable_lessons_immutable BEFORE UPDATE ON class_timetable_lessons
BEGIN SELECT RAISE(ABORT, 'Create a new timetable revision instead'); END;
CREATE TABLE student_timetable_checks (
  lesson_id TEXT NOT NULL,
  enrollment_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('TODO', 'PREPARATION')),
  lesson_date TEXT NOT NULL CHECK (date(lesson_date, '+0 days') IS NOT NULL AND date(lesson_date, '+0 days') = lesson_date),
  completed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (lesson_id, enrollment_id, kind, lesson_date),
  FOREIGN KEY (lesson_id, class_id) REFERENCES class_timetable_lessons(id, class_id) ON DELETE RESTRICT,
  FOREIGN KEY (enrollment_id, class_id) REFERENCES student_enrollments(id, class_id) ON DELETE RESTRICT
);
CREATE INDEX idx_student_timetable_checks_date ON student_timetable_checks(enrollment_id, lesson_date, kind);

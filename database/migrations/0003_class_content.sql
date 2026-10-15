-- Editorial content and the private daily checklist. Business dates use Vietnam time.
ALTER TABLE posts ADD COLUMN category TEXT NOT NULL DEFAULT 'GENERAL'
  CHECK (category IN ('GENERAL', 'CLASS_STORY', 'KINDNESS', 'PARENT_GUIDE', 'DISCOVERY'));
ALTER TABLE posts ADD COLUMN cover_url TEXT;
CREATE INDEX idx_posts_public_bulletin ON posts(status, visibility, is_pinned, published_at);
CREATE INDEX idx_class_post_category ON posts(class_id, category, status, published_at);

CREATE TABLE class_events (
  id TEXT PRIMARY KEY NOT NULL,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  body TEXT NOT NULL DEFAULT '',
  event_date TEXT NOT NULL CHECK (
    date(event_date, '+0 days') IS NOT NULL AND date(event_date, '+0 days') = event_date
  ),
  starts_at TEXT CHECK (starts_at IS NULL OR (
    length(starts_at) = 5 AND starts_at GLOB '[0-2][0-9]:[0-5][0-9]'
    AND substr(starts_at, 1, 2) <= '23'
  )),
  visibility TEXT NOT NULL DEFAULT 'PRIVATE' CHECK (visibility IN ('PUBLIC', 'PRIVATE')),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_class_events_week ON class_events(class_id, status, event_date, starts_at);
CREATE INDEX idx_public_events_week ON class_events(status, visibility, event_date, starts_at);

CREATE TABLE class_tasks (
  id TEXT PRIMARY KEY NOT NULL,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  details TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL CHECK (kind IN ('TODO', 'PREPARATION')),
  -- NULL means a recurring daily task, never an invented event date.
  task_date TEXT CHECK (task_date IS NULL OR (
    date(task_date, '+0 days') IS NOT NULL AND date(task_date, '+0 days') = task_date
  )),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (typeof(sort_order) = 'integer' AND sort_order >= 0),
  status TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('PUBLISHED', 'ARCHIVED')),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (id, class_id)
);
CREATE INDEX idx_class_tasks_day ON class_tasks(class_id, status, kind, task_date, sort_order);

CREATE TABLE student_task_completions (
  task_id TEXT NOT NULL,
  enrollment_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  -- Completion is recorded for the day the child prepares/checks the task,
  -- including PREPARATION tasks whose target date is tomorrow.
  completion_date TEXT NOT NULL CHECK (
    date(completion_date, '+0 days') IS NOT NULL AND date(completion_date, '+0 days') = completion_date
  ),
  completed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (task_id, enrollment_id, completion_date),
  FOREIGN KEY (task_id, class_id) REFERENCES class_tasks(id, class_id) ON DELETE RESTRICT,
  FOREIGN KEY (enrollment_id, class_id) REFERENCES student_enrollments(id, class_id) ON DELETE RESTRICT
);
CREATE INDEX idx_student_tasks_day ON student_task_completions(enrollment_id, completion_date, class_id);

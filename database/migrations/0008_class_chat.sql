-- Class chat is separate from the confidential "Lời thì thầm" message inbox.
-- A null thread is the class room; a pupil thread is visible only to that pupil
-- and staff who currently manage the class. There are no pupil-to-pupil threads.
CREATE TABLE class_chat_messages (
  id TEXT PRIMARY KEY NOT NULL,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  thread_enrollment_id TEXT,
  sender_kind TEXT NOT NULL CHECK (sender_kind IN ('TEACHER', 'STUDENT')),
  sender_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  sender_account_id TEXT REFERENCES student_accounts(id) ON DELETE RESTRICT,
  sender_enrollment_id TEXT,
  actor_key TEXT GENERATED ALWAYS AS (
    CASE sender_kind WHEN 'TEACHER' THEN 'teacher:' || sender_user_id
      ELSE 'student:' || sender_account_id END
  ) STORED,
  client_message_id TEXT NOT NULL CHECK (length(client_message_id) = 36),
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 2000 AND instr(body, char(0)) = 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  hidden_at TEXT,
  hidden_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (thread_enrollment_id, class_id) REFERENCES student_enrollments(id, class_id) ON DELETE RESTRICT,
  FOREIGN KEY (sender_enrollment_id, class_id) REFERENCES student_enrollments(id, class_id) ON DELETE RESTRICT,
  UNIQUE (actor_key, client_message_id),
  CHECK ((sender_kind = 'TEACHER' AND sender_user_id IS NOT NULL AND sender_account_id IS NULL AND sender_enrollment_id IS NULL)
    OR (sender_kind = 'STUDENT' AND sender_user_id IS NULL AND sender_account_id IS NOT NULL AND sender_enrollment_id IS NOT NULL)),
  CHECK (sender_kind <> 'STUDENT' OR thread_enrollment_id IS NULL OR thread_enrollment_id = sender_enrollment_id),
  CHECK ((hidden_at IS NULL AND hidden_by IS NULL) OR (hidden_at IS NOT NULL AND hidden_by IS NOT NULL))
);
CREATE INDEX idx_class_chat_thread ON class_chat_messages(class_id, thread_enrollment_id, created_at DESC, id DESC);
CREATE INDEX idx_class_chat_actor_rate ON class_chat_messages(actor_key, created_at DESC);
CREATE TRIGGER trg_class_chat_student_link BEFORE INSERT ON class_chat_messages
WHEN NEW.sender_kind = 'STUDENT' AND NOT EXISTS (
  SELECT 1 FROM student_enrollments enrollment
  JOIN student_account_students link ON link.student_id = enrollment.student_id
  WHERE enrollment.id = NEW.sender_enrollment_id AND enrollment.class_id = NEW.class_id
    AND link.account_id = NEW.sender_account_id
)
BEGIN SELECT RAISE(ABORT, 'Chat pupil must belong to the sending account'); END;
-- Content, identities and idempotency keys are immutable. Staff moderation may
-- only hide a message; the original remains in the database for accountability.
CREATE TRIGGER trg_class_chat_message_immutable BEFORE UPDATE ON class_chat_messages
WHEN NEW.id IS NOT OLD.id OR NEW.class_id IS NOT OLD.class_id
  OR NEW.thread_enrollment_id IS NOT OLD.thread_enrollment_id
  OR NEW.sender_kind IS NOT OLD.sender_kind OR NEW.sender_user_id IS NOT OLD.sender_user_id
  OR NEW.sender_account_id IS NOT OLD.sender_account_id OR NEW.sender_enrollment_id IS NOT OLD.sender_enrollment_id
  OR NEW.client_message_id IS NOT OLD.client_message_id OR NEW.body IS NOT OLD.body OR NEW.created_at IS NOT OLD.created_at
  OR OLD.hidden_at IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'Chat content is immutable'); END;

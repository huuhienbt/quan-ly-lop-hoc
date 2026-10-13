-- Lớp học hạnh phúc — schema cho cả bốn giai đoạn.
-- Cloudflare D1 / SQLite. Áp dụng bằng Wrangler migrations, không thêm BEGIN/COMMIT.
-- ID do server tạo bằng crypto.randomUUID(). Timestamp UTC; ngày nghiệp vụ YYYY-MM-DD
-- được tính theo Asia/Ho_Chi_Minh. updated_at phải được cập nhật bởi ứng dụng.
PRAGMA foreign_keys = ON;

CREATE TABLE schools (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  slug TEXT NOT NULL UNIQUE CHECK (length(slug) > 0 AND slug = lower(slug)),
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(email)) > 0),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  image_url TEXT,
  email_verified_at TEXT,
  role TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (role IN ('PENDING', 'TEACHER', 'SUPER_ADMIN')),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Chỉ lưu định danh Google sub; không cần lưu access/refresh token Google.
-- Đây là schema ứng dụng, không phải schema adapter mặc định của NextAuth.
CREATE TABLE accounts (
  provider TEXT NOT NULL DEFAULT 'google' CHECK (provider = 'google'),
  provider_account_id TEXT NOT NULL CHECK (length(provider_account_id) > 0),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (provider, provider_account_id),
  UNIQUE (user_id, provider)
);

CREATE TABLE teacher_requests (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  reviewed_at TEXT,
  review_note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, school_id),
  CHECK (
    (status = 'PENDING' AND reviewed_by IS NULL AND reviewed_at IS NULL) OR
    (status IN ('APPROVED', 'REJECTED') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);
CREATE INDEX idx_teacher_requests_review ON teacher_requests(school_id, status, created_at);

CREATE TABLE academic_years (
  id TEXT PRIMARY KEY NOT NULL,
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0 CHECK (is_current IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (school_id, name),
  UNIQUE (id, school_id),
  CHECK (date(starts_on, '+0 days') IS NOT NULL AND date(starts_on, '+0 days') = starts_on),
  CHECK (date(ends_on, '+0 days') IS NOT NULL AND date(ends_on, '+0 days') = ends_on),
  CHECK (starts_on < ends_on)
);
CREATE UNIQUE INDEX idx_one_current_year ON academic_years(school_id) WHERE is_current = 1;

CREATE TABLE classes (
  id TEXT PRIMARY KEY NOT NULL,
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  academic_year_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  -- Slug duy nhất toàn hệ thống cho /lop/[slug], nên có cả năm học.
  slug TEXT NOT NULL UNIQUE CHECK (length(slug) > 0 AND slug = lower(slug)),
  grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 5),
  greeting TEXT,
  banner_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'PRIVATE' CHECK (visibility IN ('PRIVATE', 'PUBLIC')),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (academic_year_id, school_id) REFERENCES academic_years(id, school_id) ON DELETE RESTRICT,
  UNIQUE (school_id, academic_year_id, name),
  UNIQUE (id, school_id),
  UNIQUE (id, school_id, academic_year_id)
);
CREATE INDEX idx_classes_school_year ON classes(school_id, academic_year_id, archived_at);

CREATE TABLE class_teachers (
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_homeroom INTEGER NOT NULL DEFAULT 1 CHECK (is_homeroom IN (0, 1)),
  assigned_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  assigned_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ended_at TEXT,
  PRIMARY KEY (class_id, user_id)
);
CREATE UNIQUE INDEX idx_one_homeroom_teacher ON class_teachers(class_id)
  WHERE is_homeroom = 1 AND ended_at IS NULL;
CREATE INDEX idx_teacher_classes ON class_teachers(user_id, ended_at, class_id);

-- Ngăn phân công tài khoản chưa duyệt. Quyền của người thao tác vẫn phải kiểm tra ở server.
CREATE TRIGGER trg_class_teacher_insert BEFORE INSERT ON class_teachers
WHEN NEW.ended_at IS NULL AND NOT EXISTS (
  SELECT 1 FROM users WHERE id = NEW.user_id AND role IN ('TEACHER', 'SUPER_ADMIN') AND status = 'ACTIVE'
)
BEGIN
  SELECT RAISE(ABORT, 'Teacher must be approved and active');
END;
CREATE TRIGGER trg_class_teacher_update BEFORE UPDATE ON class_teachers
WHEN NEW.ended_at IS NULL AND NOT EXISTS (
  SELECT 1 FROM users WHERE id = NEW.user_id AND role IN ('TEACHER', 'SUPER_ADMIN') AND status = 'ACTIVE'
)
BEGIN
  SELECT RAISE(ABORT, 'Teacher must be approved and active');
END;

-- Thu hồi quyền sẽ kết thúc phân công ngay; kích hoạt lại tài khoản không tự gán lại lớp.
CREATE TRIGGER trg_end_assignments_on_revoke AFTER UPDATE OF role, status ON users
WHEN NEW.role NOT IN ('TEACHER', 'SUPER_ADMIN') OR NEW.status <> 'ACTIVE'
BEGIN
  UPDATE class_teachers SET ended_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE user_id = NEW.id AND ended_at IS NULL;
END;

CREATE TABLE students (
  id TEXT PRIMARY KEY NOT NULL,
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  student_code TEXT,
  full_name TEXT NOT NULL CHECK (length(trim(full_name)) > 0),
  display_name TEXT,
  gender TEXT NOT NULL DEFAULT 'UNSPECIFIED' CHECK (gender IN ('MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED')),
  date_of_birth TEXT,
  avatar_key TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (school_id, student_code),
  UNIQUE (id, school_id),
  CHECK (date_of_birth IS NULL OR
    (date(date_of_birth, '+0 days') IS NOT NULL AND date(date_of_birth, '+0 days') = date_of_birth))
);
CREATE INDEX idx_students_school ON students(school_id, archived_at, full_name);

CREATE TABLE student_enrollments (
  id TEXT PRIMARY KEY NOT NULL,
  student_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  school_id TEXT NOT NULL,
  academic_year_id TEXT NOT NULL,
  student_number INTEGER CHECK (student_number IS NULL OR student_number > 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'TRANSFERRED', 'GRADUATED', 'WITHDRAWN')),
  enrolled_on TEXT NOT NULL,
  ended_on TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (student_id, school_id) REFERENCES students(id, school_id) ON DELETE RESTRICT,
  FOREIGN KEY (class_id, school_id, academic_year_id)
    REFERENCES classes(id, school_id, academic_year_id) ON DELETE RESTRICT,
  UNIQUE (class_id, student_id),
  UNIQUE (class_id, student_number),
  UNIQUE (id, class_id),
  CHECK (date(enrolled_on, '+0 days') IS NOT NULL AND date(enrolled_on, '+0 days') = enrolled_on),
  CHECK (ended_on IS NULL OR
    (date(ended_on, '+0 days') IS NOT NULL AND date(ended_on, '+0 days') = ended_on AND ended_on >= enrolled_on)),
  CHECK ((status = 'ACTIVE' AND ended_on IS NULL) OR (status <> 'ACTIVE' AND ended_on IS NOT NULL))
);
CREATE UNIQUE INDEX idx_one_active_enrollment ON student_enrollments(student_id, academic_year_id)
  WHERE status = 'ACTIVE';
CREATE INDEX idx_class_students ON student_enrollments(class_id, status, student_number);

CREATE TABLE posts (
  id TEXT PRIMARY KEY NOT NULL,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL DEFAULT 'NEWS' CHECK (kind IN ('NEWS', 'ANNOUNCEMENT', 'ACTIVITY')),
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  body TEXT NOT NULL CHECK (length(trim(body)) > 0),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  visibility TEXT NOT NULL DEFAULT 'PRIVATE' CHECK (visibility IN ('PRIVATE', 'PUBLIC')),
  is_pinned INTEGER NOT NULL DEFAULT 0 CHECK (is_pinned IN (0, 1)),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (id, class_id),
  CHECK (status <> 'PUBLISHED' OR published_at IS NOT NULL)
);
CREATE INDEX idx_class_newsfeed ON posts(class_id, status, is_pinned, published_at);

-- D1 lưu metadata; dữ liệu ảnh nằm trong R2/Cloudflare Images hoặc dịch vụ lưu trữ ảnh.
CREATE TABLE media_assets (
  id TEXT PRIMARY KEY NOT NULL,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  uploaded_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  storage_key TEXT,
  url TEXT NOT NULL CHECK (length(trim(url)) > 0),
  mime_type TEXT NOT NULL,
  alt_text TEXT,
  width INTEGER CHECK (width IS NULL OR width > 0),
  height INTEGER CHECK (height IS NULL OR height > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (id, class_id)
);
CREATE INDEX idx_class_media ON media_assets(class_id, created_at);

CREATE TABLE post_media (
  post_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  PRIMARY KEY (post_id, asset_id),
  UNIQUE (post_id, sort_order),
  FOREIGN KEY (post_id, class_id) REFERENCES posts(id, class_id) ON DELETE CASCADE,
  FOREIGN KEY (asset_id, class_id) REFERENCES media_assets(id, class_id) ON DELETE RESTRICT
);
CREATE INDEX idx_post_media_asset ON post_media(asset_id, class_id);

-- Sổ cộng/trừ sao bất biến. Sửa sai bằng giao dịch bù, không UPDATE/DELETE lịch sử.
CREATE TABLE stars (
  id TEXT PRIMARY KEY NOT NULL,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  enrollment_id TEXT NOT NULL,
  delta INTEGER NOT NULL CHECK (typeof(delta) = 'integer' AND delta <> 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) > 0),
  awarded_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  reverses_id TEXT UNIQUE REFERENCES stars(id) ON DELETE RESTRICT,
  -- Client/server giữ cùng key khi retry để không cộng hai lần.
  idempotency_key TEXT NOT NULL UNIQUE CHECK (length(idempotency_key) > 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (enrollment_id, class_id) REFERENCES student_enrollments(id, class_id) ON DELETE RESTRICT,
  CHECK (reverses_id IS NULL OR reverses_id <> id)
);
CREATE INDEX idx_student_star_history ON stars(enrollment_id, created_at);
CREATE INDEX idx_class_star_history ON stars(class_id, created_at);
-- REPLACE cũng có thể ghi đè hàng mà bỏ qua DELETE trigger của SQLite.
CREATE TRIGGER trg_stars_no_replace BEFORE INSERT ON stars
WHEN EXISTS (
  SELECT 1 FROM stars WHERE id = NEW.id OR idempotency_key = NEW.idempotency_key
    OR (NEW.reverses_id IS NOT NULL AND reverses_id = NEW.reverses_id)
)
BEGIN
  SELECT RAISE(ABORT, 'Duplicate star transaction; never replace ledger rows');
END;
CREATE TRIGGER trg_stars_nonnegative BEFORE INSERT ON stars
WHEN COALESCE((SELECT SUM(delta) FROM stars WHERE enrollment_id = NEW.enrollment_id), 0) + NEW.delta < 0
BEGIN
  SELECT RAISE(ABORT, 'Star balance cannot be negative');
END;
CREATE TRIGGER trg_stars_reversal BEFORE INSERT ON stars
WHEN NEW.reverses_id IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM stars WHERE id = NEW.reverses_id AND enrollment_id = NEW.enrollment_id
    AND class_id = NEW.class_id AND delta = -NEW.delta
)
BEGIN
  SELECT RAISE(ABORT, 'Reversal must negate the original transaction for the same enrollment');
END;
CREATE TRIGGER trg_stars_no_update BEFORE UPDATE ON stars
BEGIN
  SELECT RAISE(ABORT, 'Star ledger is immutable; insert a compensating transaction');
END;
CREATE TRIGGER trg_stars_no_delete BEFORE DELETE ON stars
BEGIN
  SELECT RAISE(ABORT, 'Star ledger is immutable; insert a compensating transaction');
END;
CREATE VIEW student_star_balances AS
SELECT e.id AS enrollment_id, e.class_id, e.student_id, COALESCE(SUM(s.delta), 0) AS total_stars
FROM student_enrollments e LEFT JOIN stars s ON s.enrollment_id = e.id
GROUP BY e.id, e.class_id, e.student_id;

CREATE TABLE moods (
  id TEXT PRIMARY KEY NOT NULL,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  enrollment_id TEXT NOT NULL,
  local_date TEXT NOT NULL,
  mood TEXT NOT NULL CHECK (mood IN ('HAPPY', 'SAD', 'EXCITED', 'CALM', 'WORRIED', 'ANGRY', 'TIRED')),
  note TEXT,
  submitted_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (enrollment_id, class_id) REFERENCES student_enrollments(id, class_id) ON DELETE RESTRICT,
  UNIQUE (enrollment_id, local_date),
  CHECK (date(local_date, '+0 days') IS NOT NULL AND date(local_date, '+0 days') = local_date)
);
CREATE INDEX idx_class_moods ON moods(class_id, local_date, mood);

CREATE TABLE messages (
  id TEXT PRIMARY KEY NOT NULL,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  sender_kind TEXT NOT NULL CHECK (sender_kind IN ('STUDENT', 'PARENT', 'OTHER')),
  is_anonymous INTEGER NOT NULL DEFAULT 1 CHECK (is_anonymous IN (0, 1)),
  sender_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  sender_enrollment_id TEXT,
  sender_name TEXT,
  sender_contact TEXT,
  subject TEXT,
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 10000),
  status TEXT NOT NULL DEFAULT 'UNREAD' CHECK (status IN ('UNREAD', 'READ', 'REPLIED', 'ARCHIVED')),
  teacher_reply TEXT,
  replied_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  replied_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (sender_enrollment_id, class_id) REFERENCES student_enrollments(id, class_id) ON DELETE RESTRICT,
  CHECK ((is_anonymous = 1 AND sender_user_id IS NULL AND sender_enrollment_id IS NULL
      AND sender_name IS NULL AND sender_contact IS NULL) OR
    (is_anonymous = 0 AND (sender_user_id IS NOT NULL OR sender_enrollment_id IS NOT NULL
      OR length(trim(COALESCE(sender_name, ''))) > 0))),
  CHECK ((teacher_reply IS NULL AND replied_by IS NULL AND replied_at IS NULL) OR
    (length(trim(COALESCE(teacher_reply, ''))) > 0 AND replied_by IS NOT NULL AND replied_at IS NOT NULL)),
  CHECK (status <> 'REPLIED' OR teacher_reply IS NOT NULL)
);
CREATE INDEX idx_teacher_mailbox ON messages(class_id, status, created_at);

CREATE TABLE gratitudes (
  id TEXT PRIMARY KEY NOT NULL,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  author_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  author_enrollment_id TEXT,
  author_name TEXT,
  recipient_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  recipient_enrollment_id TEXT,
  recipient_label TEXT,
  body TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  moderated_by TEXT REFERENCES users(id) ON DELETE RESTRICT,
  moderated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (author_enrollment_id, class_id) REFERENCES student_enrollments(id, class_id) ON DELETE RESTRICT,
  FOREIGN KEY (recipient_enrollment_id, class_id) REFERENCES student_enrollments(id, class_id) ON DELETE RESTRICT,
  CHECK (author_user_id IS NOT NULL OR author_enrollment_id IS NOT NULL OR length(trim(COALESCE(author_name, ''))) > 0),
  CHECK (NOT (recipient_user_id IS NOT NULL AND recipient_enrollment_id IS NOT NULL)),
  CHECK (recipient_user_id IS NOT NULL OR recipient_enrollment_id IS NOT NULL OR length(trim(COALESCE(recipient_label, ''))) > 0),
  CHECK ((status = 'PENDING' AND moderated_by IS NULL AND moderated_at IS NULL) OR
    (status IN ('APPROVED', 'REJECTED') AND moderated_by IS NOT NULL AND moderated_at IS NOT NULL))
);
CREATE INDEX idx_class_gratitudes ON gratitudes(class_id, status, created_at);

CREATE TABLE albums (
  id TEXT PRIMARY KEY NOT NULL,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT,
  event_date TEXT,
  visibility TEXT NOT NULL DEFAULT 'PRIVATE' CHECK (visibility IN ('PRIVATE', 'PUBLIC')),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (id, class_id),
  CHECK (event_date IS NULL OR (date(event_date, '+0 days') IS NOT NULL AND date(event_date, '+0 days') = event_date))
);
CREATE INDEX idx_class_albums ON albums(class_id, archived_at, event_date);

CREATE TABLE photos (
  id TEXT PRIMARY KEY NOT NULL,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  album_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  added_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (album_id, class_id) REFERENCES albums(id, class_id) ON DELETE RESTRICT,
  FOREIGN KEY (asset_id, class_id) REFERENCES media_assets(id, class_id) ON DELETE RESTRICT,
  UNIQUE (album_id, asset_id),
  UNIQUE (id, class_id)
);
CREATE INDEX idx_album_photos ON photos(album_id, sort_order);
CREATE INDEX idx_photo_asset ON photos(asset_id, class_id);

CREATE TABLE photo_likes (
  id TEXT PRIMARY KEY NOT NULL,
  photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  -- Khóa khách ngẫu nhiên trong cookie, băm ở server; không dùng IP/fingerprint.
  visitor_token_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((user_id IS NOT NULL AND visitor_token_hash IS NULL) OR
    (user_id IS NULL AND length(COALESCE(visitor_token_hash, '')) = 64)),
  UNIQUE (photo_id, user_id),
  UNIQUE (photo_id, visitor_token_hash)
);
CREATE INDEX idx_likes_user ON photo_likes(user_id);

-- Lưu kết quả chia nhóm/quay nếu GVCN muốn giữ lịch sử; giao diện ở Giai đoạn 4.
CREATE TABLE group_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  title TEXT,
  group_count INTEGER NOT NULL CHECK (group_count > 0),
  method TEXT NOT NULL DEFAULT 'RANDOM' CHECK (method IN ('RANDOM', 'MANUAL')),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (id, class_id)
);
CREATE INDEX idx_class_group_sessions ON group_sessions(class_id, created_at);

CREATE TABLE student_groups (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  group_number INTEGER NOT NULL CHECK (group_number > 0),
  name TEXT,
  FOREIGN KEY (session_id, class_id) REFERENCES group_sessions(id, class_id) ON DELETE CASCADE,
  UNIQUE (session_id, group_number),
  UNIQUE (id, session_id, class_id)
);

CREATE TABLE group_members (
  group_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  enrollment_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  PRIMARY KEY (session_id, enrollment_id),
  FOREIGN KEY (group_id, session_id, class_id) REFERENCES student_groups(id, session_id, class_id) ON DELETE CASCADE,
  FOREIGN KEY (enrollment_id, class_id) REFERENCES student_enrollments(id, class_id) ON DELETE RESTRICT
);
CREATE INDEX idx_group_members ON group_members(group_id, sort_order);
CREATE INDEX idx_group_enrollment ON group_members(enrollment_id, class_id);

CREATE TABLE wheel_draws (
  id TEXT PRIMARY KEY NOT NULL,
  class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
  enrollment_id TEXT NOT NULL,
  drawn_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  session_key TEXT,
  drawn_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (enrollment_id, class_id) REFERENCES student_enrollments(id, class_id) ON DELETE RESTRICT
);
CREATE INDEX idx_class_wheel_draws ON wheel_draws(class_id, session_key, drawn_at);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  actor_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  school_id TEXT REFERENCES schools(id) ON DELETE RESTRICT,
  class_id TEXT,
  action TEXT NOT NULL CHECK (length(trim(action)) > 0),
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (class_id, school_id) REFERENCES classes(id, school_id) ON DELETE RESTRICT,
  CHECK (class_id IS NULL OR school_id IS NOT NULL)
);
CREATE INDEX idx_audit_class ON audit_logs(class_id, created_at);
CREATE INDEX idx_audit_actor ON audit_logs(actor_user_id, created_at);

-- Chỉ seed thông tin đã biết. Năm học và lớp Bốn 12 sẽ được tạo trong /admin.
INSERT INTO schools (id, name, slug)
VALUES ('school-ben-tre', 'Trường Tiểu học Bến Tre', 'tieu-hoc-ben-tre');

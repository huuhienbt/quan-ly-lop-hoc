-- Student/family login is separate from Google staff identities.
-- Password hashes are generated per account by the server; no default plaintext is stored.
CREATE TABLE student_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  phone TEXT NOT NULL UNIQUE CHECK (
    length(phone) = 10 AND substr(phone, 1, 1) = '0'
    AND substr(phone, 2, 1) IN ('3', '5', '7', '8', '9')
    AND phone NOT GLOB '*[^0-9]*'
  ),
  password_hash TEXT NOT NULL CHECK (
    length(password_hash) BETWEEN 178 AND 274 AND length(password_hash) % 2 = 0
    AND substr(password_hash, 1, 17) = 'scrypt$16384$8$1$'
    AND substr(password_hash, length(password_hash) - 128, 1) = '$'
    AND substr(password_hash, 18, length(password_hash) - 146) NOT GLOB '*[^0-9a-f]*'
    AND substr(password_hash, -128) NOT GLOB '*[^0-9a-f]*'
  ),
  must_change_password INTEGER NOT NULL DEFAULT 1 CHECK (must_change_password IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),
  session_version INTEGER NOT NULL DEFAULT 1 CHECK (typeof(session_version) = 'integer' AND session_version >= 1),
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (typeof(failed_attempts) = 'integer' AND failed_attempts BETWEEN 0 AND 5),
  failure_window_started_at TEXT,
  locked_until TEXT,
  last_login_at TEXT,
  password_changed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- One family phone may access multiple children; a student belongs to one login.
CREATE TABLE student_account_students (
  account_id TEXT NOT NULL REFERENCES student_accounts(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL UNIQUE REFERENCES students(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (account_id, student_id)
);

-- Existing passwords keep their existing behavior; only newly issued bulk passwords expire.
ALTER TABLE student_accounts ADD COLUMN temporary_password_expires_at TEXT
  CHECK (temporary_password_expires_at IS NULL OR (
    must_change_password = 1
    AND strftime('%Y-%m-%dT%H:%M:%fZ', temporary_password_expires_at) IS NOT NULL
    AND strftime('%Y-%m-%dT%H:%M:%fZ', temporary_password_expires_at) = temporary_password_expires_at
  ));

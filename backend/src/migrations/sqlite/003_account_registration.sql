CREATE UNIQUE INDEX idx_users_username_case_insensitive ON users (lower(username));
ALTER TABLE users ADD COLUMN requested_role TEXT CHECK (requested_role IN ('employee', 'manager', 'hr', 'finance', 'executive'));
CREATE TABLE account_role_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  previous_role TEXT NOT NULL,
  assigned_role TEXT NOT NULL,
  previous_employee_id INTEGER REFERENCES employees(id),
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  requested_role TEXT,
  operator TEXT NOT NULL CHECK(length(trim(operator)) > 0),
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_account_role_history_user ON account_role_history(user_id, changed_at DESC);

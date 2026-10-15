CREATE TABLE employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_code TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  department TEXT NOT NULL,
  position TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resigned')),
  start_date TEXT NOT NULL,
  resignation_date TEXT,
  resignation_reason TEXT,
  -- confidential personal data
  national_id TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_employees_name ON employees (first_name, last_name);
CREATE INDEX idx_employees_department ON employees (department);
CREATE INDEX idx_employees_status ON employees (status);

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('employee', 'manager', 'hr', 'finance', 'executive')),
  employee_id INTEGER REFERENCES employees (id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE salaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees (id),
  amount REAL NOT NULL CHECK (amount > 0),
  effective_date TEXT NOT NULL,
  note TEXT,
  created_by INTEGER REFERENCES users (id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_salaries_employee ON salaries (employee_id, effective_date);

CREATE TABLE employee_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees (id),
  event_type TEXT NOT NULL CHECK (event_type IN ('hired', 'updated', 'position_changed', 'department_changed', 'resigned')),
  description TEXT NOT NULL,
  event_date TEXT NOT NULL,
  created_by INTEGER REFERENCES users (id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_history_employee ON employee_history (employee_id);

CREATE TABLE announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  published_at TEXT NOT NULL
);

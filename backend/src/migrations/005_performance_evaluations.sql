CREATE TABLE performance_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  evaluation_period TEXT NOT NULL,
  evaluation_date TEXT NOT NULL,
  evaluator_name TEXT NOT NULL,
  score_1 INTEGER NOT NULL CHECK(score_1 BETWEEN 1 AND 5),
  score_2 INTEGER NOT NULL CHECK(score_2 BETWEEN 1 AND 5),
  score_3 INTEGER NOT NULL CHECK(score_3 BETWEEN 1 AND 5),
  score_4 INTEGER NOT NULL CHECK(score_4 BETWEEN 1 AND 5),
  score_5 INTEGER NOT NULL CHECK(score_5 BETWEEN 1 AND 5),
  score_6 INTEGER NOT NULL CHECK(score_6 BETWEEN 1 AND 5),
  deficiencies TEXT NOT NULL DEFAULT '',
  recommendations TEXT NOT NULL DEFAULT '',
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_evaluations_employee ON performance_evaluations(employee_id, evaluation_date DESC, id DESC);

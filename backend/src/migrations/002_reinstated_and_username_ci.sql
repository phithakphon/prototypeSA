-- 1) Allow the 'reinstated' employee history event (POST /api/employees/:id/reinstate).
--    Only widens a CHECK constraint: no rows are changed or removed.
ALTER TABLE employee_history DROP CONSTRAINT IF EXISTS employee_history_event_type_check;
ALTER TABLE employee_history ADD CONSTRAINT employee_history_event_type_check
  CHECK (event_type IN ('hired', 'updated', 'position_changed', 'department_changed', 'resigned', 'reinstated'));

-- 2) Usernames are unique ignoring case (registration rejects 'Alice' when 'alice' exists).
--    The existing case-sensitive UNIQUE (username) constraint stays in place.
CREATE UNIQUE INDEX users_username_lower_key ON users (lower(username));

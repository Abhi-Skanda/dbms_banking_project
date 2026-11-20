-- =====================================================================
-- 07_auth.sql : Users, roles, sessions, login with lockout, audit user
-- Safe to run on an existing database:  npm run db:auth
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- bcrypt via crypt() / gen_salt()

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'STAFF', 'CUSTOMER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------
-- A login belongs to exactly ONE person: a customer OR an employee.
CREATE TABLE IF NOT EXISTS app_user (
    user_id         SERIAL PRIMARY KEY,
    username        VARCHAR(30) NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9._-]{3,30}$'),
    password_hash   TEXT        NOT NULL,                       -- bcrypt, never plain text
    role            user_role   NOT NULL,
    customer_id     INT UNIQUE REFERENCES customer(customer_id) ON DELETE CASCADE,
    employee_id     INT UNIQUE REFERENCES employee(employee_id) ON DELETE CASCADE,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    failed_attempts INT         NOT NULL DEFAULT 0,
    locked_until    TIMESTAMPTZ,
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_user_link CHECK (
        (role = 'CUSTOMER'            AND customer_id IS NOT NULL AND employee_id IS NULL) OR
        (role IN ('ADMIN', 'STAFF')   AND employee_id IS NOT NULL AND customer_id IS NULL)
    )
);

-- Server-side sessions: only a SHA-256 hash of the cookie token is stored.
CREATE TABLE IF NOT EXISTS app_session (
    token_hash  CHAR(64)    PRIMARY KEY,
    user_id     INT         NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_user   ON app_session(user_id);
CREATE INDEX IF NOT EXISTS idx_session_expiry ON app_session(expires_at);

-- ---------------------------------------------------------------------
-- Audit log now records the REAL app user (set per request by the API via
-- set_config('app.username', ...)); falls back to the DB user otherwise.
ALTER TABLE audit_log ALTER COLUMN changed_by
    SET DEFAULT COALESCE(NULLIF(current_setting('app.username', true), ''), current_user);

-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_create_user(
    p_username TEXT, p_password TEXT, p_role user_role,
    p_customer_id INT DEFAULT NULL, p_employee_id INT DEFAULT NULL
) RETURNS INT LANGUAGE plpgsql AS $$
DECLARE v_id INT;
BEGIN
    IF length(p_password) < 8 THEN
        RAISE EXCEPTION 'Password must be at least 8 characters';
    END IF;
    INSERT INTO app_user (username, password_hash, role, customer_id, employee_id)
    VALUES (lower(trim(p_username)), crypt(p_password, gen_salt('bf', 10)), p_role, p_customer_id, p_employee_id)
    RETURNING user_id INTO v_id;
    RETURN v_id;
END $$;

-- Returns a status instead of raising, so failed-attempt counters are saved
-- (an exception would roll the counter back).
CREATE OR REPLACE FUNCTION fn_login(p_username TEXT, p_password TEXT)
RETURNS TABLE (user_id INT, status TEXT) LANGUAGE plpgsql AS $$
DECLARE u app_user%ROWTYPE;
BEGIN
    SELECT * INTO u FROM app_user WHERE app_user.username = lower(trim(p_username)) FOR UPDATE;

    IF NOT FOUND THEN
        PERFORM crypt(p_password, gen_salt('bf', 10));          -- same cost as a real check
        RETURN QUERY SELECT NULL::INT, 'INVALID'::TEXT; RETURN;
    END IF;
    IF NOT u.is_active THEN
        RETURN QUERY SELECT NULL::INT, 'DISABLED'::TEXT; RETURN;
    END IF;
    IF u.locked_until IS NOT NULL AND u.locked_until > now() THEN
        RETURN QUERY SELECT NULL::INT, 'LOCKED'::TEXT; RETURN;
    END IF;

    IF u.password_hash = crypt(p_password, u.password_hash) THEN
        UPDATE app_user SET failed_attempts = 0, locked_until = NULL, last_login = now()
        WHERE app_user.user_id = u.user_id;
        RETURN QUERY SELECT u.user_id, 'OK'::TEXT;
    ELSE
        UPDATE app_user SET
            failed_attempts = CASE WHEN failed_attempts + 1 >= 5 THEN 0 ELSE failed_attempts + 1 END,
            locked_until    = CASE WHEN failed_attempts + 1 >= 5 THEN now() + INTERVAL '15 minutes' END
        WHERE app_user.user_id = u.user_id;
        RETURN QUERY SELECT NULL::INT, 'INVALID'::TEXT;
    END IF;
END $$;

CREATE OR REPLACE FUNCTION fn_change_password(
    p_user_id INT, p_old TEXT, p_new TEXT, p_keep_hash TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_hash TEXT;
BEGIN
    SELECT password_hash INTO v_hash FROM app_user WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
    IF v_hash <> crypt(p_old, v_hash) THEN RAISE EXCEPTION 'Current password is incorrect'; END IF;
    IF length(p_new) < 8 THEN RAISE EXCEPTION 'New password must be at least 8 characters'; END IF;
    IF p_new = p_old THEN RAISE EXCEPTION 'New password must be different from the current one'; END IF;

    UPDATE app_user SET password_hash = crypt(p_new, gen_salt('bf', 10)) WHERE user_id = p_user_id;
    -- sign out every OTHER device
    DELETE FROM app_session WHERE user_id = p_user_id AND (p_keep_hash IS NULL OR token_hash <> p_keep_hash);
END $$;

-- Admin reset: also signs the user out everywhere and clears any lock
CREATE OR REPLACE FUNCTION fn_set_password(p_user_id INT, p_new TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    IF length(p_new) < 8 THEN RAISE EXCEPTION 'Password must be at least 8 characters'; END IF;
    UPDATE app_user SET password_hash = crypt(p_new, gen_salt('bf', 10)),
                        failed_attempts = 0, locked_until = NULL
    WHERE user_id = p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
    DELETE FROM app_session WHERE user_id = p_user_id;
END $$;

CREATE OR REPLACE FUNCTION fn_set_user_active(p_user_id INT, p_active BOOLEAN) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE app_user SET is_active = p_active, failed_attempts = 0, locked_until = NULL WHERE user_id = p_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
    IF NOT p_active THEN DELETE FROM app_session WHERE user_id = p_user_id; END IF;
END $$;

-- ---------------------------------------------------------------------
-- Audit trigger for users that NEVER logs password hashes
CREATE OR REPLACE FUNCTION fn_audit_user() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_old JSONB;
    v_new JSONB;
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        v_old := to_jsonb(OLD) - 'password_hash' - 'failed_attempts' - 'locked_until' - 'last_login';
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        v_new := to_jsonb(NEW) - 'password_hash' - 'failed_attempts' - 'locked_until' - 'last_login';
    END IF;
    IF TG_OP = 'UPDATE' THEN
        v_old := v_old || jsonb_build_object('password_changed', false);
        v_new := v_new || jsonb_build_object('password_changed', OLD.password_hash IS DISTINCT FROM NEW.password_hash);
    END IF;

    INSERT INTO audit_log (table_name, operation, record_id, old_data, new_data)
    VALUES ('app_user', TG_OP, (CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END)::text, v_old, v_new);
    RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_audit_app_user_ins_del ON app_user;
DROP TRIGGER IF EXISTS trg_audit_app_user_upd ON app_user;

CREATE TRIGGER trg_audit_app_user_ins_del
    AFTER INSERT OR DELETE ON app_user
    FOR EACH ROW EXECUTE FUNCTION fn_audit_user();

CREATE TRIGGER trg_audit_app_user_upd
    AFTER UPDATE ON app_user
    FOR EACH ROW
    WHEN (OLD.role IS DISTINCT FROM NEW.role OR OLD.is_active IS DISTINCT FROM NEW.is_active
          OR OLD.password_hash IS DISTINCT FROM NEW.password_hash)
    EXECUTE FUNCTION fn_audit_user();

-- ---------------------------------------------------------------------
-- Demo logins (change or delete these before any real use!)
--   admin  / Admin@123  -> ADMIN    (employee #1, branch manager)
--   teller / Staff@123  -> STAFF    (employee #2, cashier)
--   rahul  / Rahul@123  -> CUSTOMER (customer #1)
--   sneha  / Sneha@123  -> CUSTOMER (customer #2)
--   amit   / Amit@1234  -> CUSTOMER (customer #3)
SELECT fn_create_user('admin',  'Admin@123', 'ADMIN',    NULL, 1)
WHERE NOT EXISTS (SELECT 1 FROM app_user WHERE username = 'admin')
  AND EXISTS (SELECT 1 FROM employee WHERE employee_id = 1);

SELECT fn_create_user('teller', 'Staff@123', 'STAFF',    NULL, 2)
WHERE NOT EXISTS (SELECT 1 FROM app_user WHERE username = 'teller')
  AND EXISTS (SELECT 1 FROM employee WHERE employee_id = 2);

SELECT fn_create_user('rahul',  'Rahul@123', 'CUSTOMER', 1, NULL)
WHERE NOT EXISTS (SELECT 1 FROM app_user WHERE username = 'rahul')
  AND EXISTS (SELECT 1 FROM customer WHERE customer_id = 1);

SELECT fn_create_user('sneha',  'Sneha@123', 'CUSTOMER', 2, NULL)
WHERE NOT EXISTS (SELECT 1 FROM app_user WHERE username = 'sneha')
  AND EXISTS (SELECT 1 FROM customer WHERE customer_id = 2);

SELECT fn_create_user('amit',   'Amit@1234', 'CUSTOMER', 3, NULL)
WHERE NOT EXISTS (SELECT 1 FROM app_user WHERE username = 'amit')
  AND EXISTS (SELECT 1 FROM customer WHERE customer_id = 3);

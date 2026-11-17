-- =====================================================================
-- 04_triggers.sql : Automatic rules that fire on INSERT/UPDATE/DELETE
-- =====================================================================

-- 1) Generic audit trigger: logs old/new row as JSON.
--    TG_ARGV[0] = name of the primary key column of the audited table.
CREATE OR REPLACE FUNCTION fn_audit_row() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_row JSONB;
BEGIN
    IF TG_OP = 'DELETE' THEN v_row := to_jsonb(OLD); ELSE v_row := to_jsonb(NEW); END IF;

    INSERT INTO audit_log (table_name, operation, record_id, old_data, new_data)
    VALUES (
        TG_TABLE_NAME, TG_OP, v_row ->> TG_ARGV[0],
        CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
        CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END
    );
    RETURN NULL;   -- AFTER trigger: return value ignored
END $$;

CREATE TRIGGER trg_audit_account
    AFTER INSERT OR UPDATE OR DELETE ON account
    FOR EACH ROW EXECUTE FUNCTION fn_audit_row('account_id');

CREATE TRIGGER trg_audit_customer
    AFTER INSERT OR UPDATE OR DELETE ON customer
    FOR EACH ROW EXECUTE FUNCTION fn_audit_row('customer_id');

CREATE TRIGGER trg_audit_loan
    AFTER INSERT OR UPDATE OR DELETE ON loan
    FOR EACH ROW EXECUTE FUNCTION fn_audit_row('loan_id');

-- ---------------------------------------------------------------------
-- 2) Account guard: closed accounts are frozen in time, frozen accounts
--    can't move money, identity columns can't change, closing needs 0 balance.
CREATE OR REPLACE FUNCTION fn_guard_account_update() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.status = 'CLOSED' THEN
        RAISE EXCEPTION 'Account % is closed and cannot be modified', OLD.account_id;
    END IF;
    IF NEW.account_number <> OLD.account_number OR NEW.customer_id <> OLD.customer_id THEN
        RAISE EXCEPTION 'Account number and owner cannot be changed';
    END IF;
    IF NEW.status = 'CLOSED' AND NEW.balance <> 0 THEN
        RAISE EXCEPTION 'Cannot close account % with non-zero balance', OLD.account_id;
    END IF;
    IF OLD.status = 'FROZEN' AND NEW.status = 'FROZEN' AND NEW.balance <> OLD.balance THEN
        RAISE EXCEPTION 'Account % is frozen: balance cannot change', OLD.account_id;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_guard_account
    BEFORE UPDATE ON account
    FOR EACH ROW EXECUTE FUNCTION fn_guard_account_update();

-- ---------------------------------------------------------------------
-- 3) Customers must be 18+
CREATE OR REPLACE FUNCTION fn_check_customer_age() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.dob > (CURRENT_DATE - INTERVAL '18 years') THEN
        RAISE EXCEPTION 'Customer must be at least 18 years old (dob: %)', NEW.dob;
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER trg_customer_age
    BEFORE INSERT OR UPDATE OF dob ON customer
    FOR EACH ROW EXECUTE FUNCTION fn_check_customer_age();

-- ---------------------------------------------------------------------
-- 4) Ledger is append-only: no editing or deleting transactions
CREATE OR REPLACE FUNCTION fn_protect_ledger() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Transactions are immutable: % is not allowed', TG_OP;
END $$;

CREATE TRIGGER trg_protect_ledger
    BEFORE UPDATE OR DELETE ON transactions
    FOR EACH ROW EXECUTE FUNCTION fn_protect_ledger();

-- ---------------------------------------------------------------------
-- 5) Fraud-style alert: flag any transaction >= 10,00,000
CREATE OR REPLACE FUNCTION fn_flag_high_value() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO audit_log (table_name, operation, record_id, new_data)
    VALUES ('transactions', 'ALERT', NEW.txn_id::text,
            jsonb_build_object('reason', 'High value transaction', 'amount', NEW.amount,
                               'type', NEW.txn_type));
    RETURN NULL;
END $$;

CREATE TRIGGER trg_high_value_txn
    AFTER INSERT ON transactions
    FOR EACH ROW WHEN (NEW.amount >= 1000000)
    EXECUTE FUNCTION fn_flag_high_value();

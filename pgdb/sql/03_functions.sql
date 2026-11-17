-- =====================================================================
-- 03_functions.sql : Stored functions (business logic inside the DB)
-- Each function runs as ONE transaction: any RAISE EXCEPTION rolls back
-- everything it did (the "A" and "C" of ACID).
-- =====================================================================

-- EMI = P * r * (1+r)^n / ((1+r)^n - 1)
CREATE OR REPLACE FUNCTION fn_calculate_emi(
    p_principal NUMERIC, p_annual_rate NUMERIC, p_months INT
) RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    r NUMERIC := p_annual_rate / 12 / 100;
BEGIN
    IF r = 0 THEN
        RETURN ROUND(p_principal / p_months, 2);
    END IF;
    RETURN ROUND(p_principal * r * POWER(1 + r, p_months) / (POWER(1 + r, p_months) - 1), 2);
END $$;

-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_deposit(
    p_account_id INT, p_amount NUMERIC, p_desc TEXT DEFAULT 'Cash deposit'
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
    v_status account_status;
    v_txn    BIGINT;
BEGIN
    IF p_amount <= 0 THEN RAISE EXCEPTION 'Deposit amount must be positive'; END IF;

    SELECT status INTO v_status FROM account WHERE account_id = p_account_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Account % not found', p_account_id; END IF;
    IF v_status <> 'ACTIVE' THEN RAISE EXCEPTION 'Account % is %', p_account_id, v_status; END IF;

    UPDATE account SET balance = balance + p_amount WHERE account_id = p_account_id;

    INSERT INTO transactions (txn_type, to_account_id, amount, description)
    VALUES ('DEPOSIT', p_account_id, p_amount, p_desc)
    RETURNING txn_id INTO v_txn;

    RETURN v_txn;
END $$;

-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_withdraw(
    p_account_id INT, p_amount NUMERIC, p_desc TEXT DEFAULT 'Cash withdrawal'
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
    v_status  account_status;
    v_balance NUMERIC;
    v_txn     BIGINT;
BEGIN
    IF p_amount <= 0 THEN RAISE EXCEPTION 'Withdrawal amount must be positive'; END IF;

    SELECT status, balance INTO v_status, v_balance
    FROM account WHERE account_id = p_account_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Account % not found', p_account_id; END IF;
    IF v_status <> 'ACTIVE' THEN RAISE EXCEPTION 'Account % is %', p_account_id, v_status; END IF;
    IF v_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient funds: balance %, requested %', v_balance, p_amount;
    END IF;

    UPDATE account SET balance = balance - p_amount WHERE account_id = p_account_id;

    INSERT INTO transactions (txn_type, from_account_id, amount, description)
    VALUES ('WITHDRAWAL', p_account_id, p_amount, p_desc)
    RETURNING txn_id INTO v_txn;

    RETURN v_txn;
END $$;

-- ---------------------------------------------------------------------
-- Money transfer: debit + credit + ledger entry, all-or-nothing.
-- Rows are locked in account_id order to avoid deadlocks when two
-- people transfer to each other at the same time.
CREATE OR REPLACE FUNCTION fn_transfer(
    p_from INT, p_to INT, p_amount NUMERIC, p_desc TEXT DEFAULT 'Fund transfer'
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
    v_from account%ROWTYPE;
    v_to   account%ROWTYPE;
    v_txn  BIGINT;
BEGIN
    IF p_amount <= 0 THEN RAISE EXCEPTION 'Transfer amount must be positive'; END IF;
    IF p_from = p_to THEN RAISE EXCEPTION 'Cannot transfer to the same account'; END IF;

    PERFORM 1 FROM account WHERE account_id IN (p_from, p_to) ORDER BY account_id FOR UPDATE;

    SELECT * INTO v_from FROM account WHERE account_id = p_from;
    IF NOT FOUND THEN RAISE EXCEPTION 'Source account % not found', p_from; END IF;
    SELECT * INTO v_to FROM account WHERE account_id = p_to;
    IF NOT FOUND THEN RAISE EXCEPTION 'Destination account % not found', p_to; END IF;

    IF v_from.status <> 'ACTIVE' THEN RAISE EXCEPTION 'Source account is %', v_from.status; END IF;
    IF v_to.status   <> 'ACTIVE' THEN RAISE EXCEPTION 'Destination account is %', v_to.status; END IF;
    IF v_from.balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient funds: balance %, requested %', v_from.balance, p_amount;
    END IF;

    UPDATE account SET balance = balance - p_amount WHERE account_id = p_from;
    UPDATE account SET balance = balance + p_amount WHERE account_id = p_to;

    INSERT INTO transactions (txn_type, from_account_id, to_account_id, amount, description)
    VALUES ('TRANSFER', p_from, p_to, p_amount, p_desc)
    RETURNING txn_id INTO v_txn;

    RETURN v_txn;
END $$;

-- ---------------------------------------------------------------------
-- Loan lifecycle: apply -> approve (disburse) -> pay EMIs -> auto close
CREATE OR REPLACE FUNCTION fn_apply_for_loan(
    p_customer_id INT, p_account_id INT, p_principal NUMERIC,
    p_rate NUMERIC, p_months INT
) RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    v_branch INT;
    v_owner  INT;
    v_loan   INT;
BEGIN
    SELECT branch_id, customer_id INTO v_branch, v_owner FROM account WHERE account_id = p_account_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Account % not found', p_account_id; END IF;
    IF v_owner <> p_customer_id THEN
        RAISE EXCEPTION 'Account % does not belong to customer %', p_account_id, p_customer_id;
    END IF;

    INSERT INTO loan (customer_id, branch_id, account_id, principal, interest_rate, tenure_months, emi_amount)
    VALUES (p_customer_id, v_branch, p_account_id, p_principal, p_rate, p_months,
            fn_calculate_emi(p_principal, p_rate, p_months))
    RETURNING loan_id INTO v_loan;

    RETURN v_loan;
END $$;

CREATE OR REPLACE FUNCTION fn_approve_loan(p_loan_id INT) RETURNS BIGINT
LANGUAGE plpgsql AS $$
DECLARE
    v_loan loan%ROWTYPE;
    v_txn  BIGINT;
BEGIN
    SELECT * INTO v_loan FROM loan WHERE loan_id = p_loan_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Loan % not found', p_loan_id; END IF;
    IF v_loan.status <> 'PENDING' THEN RAISE EXCEPTION 'Loan % is already %', p_loan_id, v_loan.status; END IF;

    v_txn := fn_deposit(v_loan.account_id, v_loan.principal, 'Loan disbursal #' || p_loan_id);
    UPDATE loan SET status = 'ACTIVE', start_date = CURRENT_DATE WHERE loan_id = p_loan_id;
    RETURN v_txn;
END $$;

CREATE OR REPLACE FUNCTION fn_reject_loan(p_loan_id INT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE loan SET status = 'REJECTED' WHERE loan_id = p_loan_id AND status = 'PENDING';
    IF NOT FOUND THEN RAISE EXCEPTION 'Loan % is not pending', p_loan_id; END IF;
END $$;

CREATE OR REPLACE FUNCTION fn_pay_emi(p_loan_id INT) RETURNS BIGINT
LANGUAGE plpgsql AS $$
DECLARE
    v_loan loan%ROWTYPE;
    v_txn  BIGINT;
    v_paid INT;
BEGIN
    SELECT * INTO v_loan FROM loan WHERE loan_id = p_loan_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Loan % not found', p_loan_id; END IF;
    IF v_loan.status <> 'ACTIVE' THEN RAISE EXCEPTION 'Loan % is %', p_loan_id, v_loan.status; END IF;

    v_txn := fn_withdraw(v_loan.account_id, v_loan.emi_amount, 'EMI for loan #' || p_loan_id);

    INSERT INTO loan_payment (loan_id, txn_id, amount) VALUES (p_loan_id, v_txn, v_loan.emi_amount);

    SELECT COUNT(*) INTO v_paid FROM loan_payment WHERE loan_id = p_loan_id;
    IF v_paid >= v_loan.tenure_months THEN
        UPDATE loan SET status = 'CLOSED' WHERE loan_id = p_loan_id;
    END IF;

    RETURN v_txn;
END $$;

-- ---------------------------------------------------------------------
-- Monthly interest for all active savings accounts (loop + deposit)
CREATE OR REPLACE FUNCTION fn_apply_monthly_interest(p_annual_rate NUMERIC DEFAULT 4.0)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    rec      RECORD;
    v_int    NUMERIC;
    v_count  INT := 0;
BEGIN
    FOR rec IN
        SELECT account_id, balance FROM account
        WHERE account_type = 'SAVINGS' AND status = 'ACTIVE' AND balance > 0
    LOOP
        v_int := ROUND(rec.balance * p_annual_rate / 1200, 2);
        IF v_int > 0 THEN
            PERFORM fn_deposit(rec.account_id, v_int, 'Monthly interest credit');
            v_count := v_count + 1;
        END IF;
    END LOOP;
    RETURN v_count;
END $$;

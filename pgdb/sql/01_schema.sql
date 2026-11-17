-- =====================================================================
-- 01_schema.sql : Types, sequences, tables, constraints (3NF / BCNF)
-- =====================================================================

CREATE TYPE account_type   AS ENUM ('SAVINGS', 'CURRENT');
CREATE TYPE account_status AS ENUM ('ACTIVE', 'FROZEN', 'CLOSED');
CREATE TYPE txn_type       AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER');
CREATE TYPE loan_status    AS ENUM ('PENDING', 'ACTIVE', 'CLOSED', 'REJECTED');
CREATE TYPE card_type      AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE card_status    AS ENUM ('ACTIVE', 'BLOCKED', 'EXPIRED');

CREATE SEQUENCE account_number_seq START 1000000001;

-- ---------------------------------------------------------------------
CREATE TABLE branch (
    branch_id    SERIAL PRIMARY KEY,
    branch_name  VARCHAR(100) NOT NULL,
    ifsc_code    CHAR(11)     NOT NULL UNIQUE,
    city         VARCHAR(60)  NOT NULL,
    address      VARCHAR(255)
);

-- ---------------------------------------------------------------------
CREATE TABLE employee (
    employee_id  SERIAL PRIMARY KEY,
    branch_id    INT           NOT NULL REFERENCES branch(branch_id),
    manager_id   INT           REFERENCES employee(employee_id) ON DELETE SET NULL,  -- self join
    full_name    VARCHAR(100)  NOT NULL,
    role         VARCHAR(40)   NOT NULL,
    salary       NUMERIC(12,2) NOT NULL CHECK (salary > 0),
    hire_date    DATE          NOT NULL DEFAULT CURRENT_DATE
);

-- ---------------------------------------------------------------------
CREATE TABLE customer (
    customer_id  SERIAL PRIMARY KEY,
    full_name    VARCHAR(100) NOT NULL,
    email        VARCHAR(120) NOT NULL UNIQUE
                 CHECK (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
    phone        CHAR(10)     NOT NULL UNIQUE CHECK (phone ~ '^[6-9][0-9]{9}$'),
    dob          DATE         NOT NULL,        -- age >= 18 enforced by trigger
    address      VARCHAR(255),
    kyc_verified BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
CREATE TABLE account (
    account_id     SERIAL PRIMARY KEY,
    account_number VARCHAR(12) NOT NULL UNIQUE
                   DEFAULT nextval('account_number_seq')::text,
    customer_id    INT NOT NULL REFERENCES customer(customer_id) ON DELETE RESTRICT,
    branch_id      INT NOT NULL REFERENCES branch(branch_id),
    account_type   account_type   NOT NULL,
    balance        NUMERIC(15,2)  NOT NULL DEFAULT 0
                   CONSTRAINT chk_balance_non_negative CHECK (balance >= 0),
    status         account_status NOT NULL DEFAULT 'ACTIVE',
    opened_at      TIMESTAMPTZ    NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Immutable ledger: every money movement is a row here
CREATE TABLE transactions (
    txn_id          BIGSERIAL PRIMARY KEY,
    txn_type        txn_type      NOT NULL,
    from_account_id INT REFERENCES account(account_id),
    to_account_id   INT REFERENCES account(account_id),
    amount          NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    description     VARCHAR(255),
    txn_time        TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT chk_txn_accounts CHECK (
        (txn_type = 'DEPOSIT'    AND from_account_id IS NULL     AND to_account_id IS NOT NULL) OR
        (txn_type = 'WITHDRAWAL' AND from_account_id IS NOT NULL AND to_account_id IS NULL)     OR
        (txn_type = 'TRANSFER'   AND from_account_id IS NOT NULL AND to_account_id IS NOT NULL
                                 AND from_account_id <> to_account_id)
    )
);

-- ---------------------------------------------------------------------
CREATE TABLE card (
    card_id      SERIAL PRIMARY KEY,
    account_id   INT NOT NULL REFERENCES account(account_id) ON DELETE CASCADE,
    card_number  CHAR(16) NOT NULL UNIQUE CHECK (card_number ~ '^[0-9]{16}$'),
    card_type    card_type   NOT NULL,
    expiry_date  DATE        NOT NULL,
    status       card_status NOT NULL DEFAULT 'ACTIVE'
);

-- ---------------------------------------------------------------------
CREATE TABLE loan (
    loan_id        SERIAL PRIMARY KEY,
    customer_id    INT NOT NULL REFERENCES customer(customer_id),
    branch_id      INT NOT NULL REFERENCES branch(branch_id),
    account_id     INT NOT NULL REFERENCES account(account_id),  -- disbursal + EMI debit account
    principal      NUMERIC(15,2) NOT NULL CHECK (principal > 0),
    interest_rate  NUMERIC(5,2)  NOT NULL CHECK (interest_rate BETWEEN 0 AND 40),  -- % per annum
    tenure_months  INT           NOT NULL CHECK (tenure_months BETWEEN 1 AND 360),
    emi_amount     NUMERIC(15,2) NOT NULL CHECK (emi_amount > 0),
    status         loan_status   NOT NULL DEFAULT 'PENDING',
    applied_on     DATE NOT NULL DEFAULT CURRENT_DATE,
    start_date     DATE
);

CREATE TABLE loan_payment (
    payment_id  SERIAL PRIMARY KEY,
    loan_id     INT NOT NULL REFERENCES loan(loan_id) ON DELETE CASCADE,
    txn_id      BIGINT NOT NULL REFERENCES transactions(txn_id),
    amount      NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    paid_on     DATE NOT NULL DEFAULT CURRENT_DATE
);

-- ---------------------------------------------------------------------
CREATE TABLE audit_log (
    log_id      BIGSERIAL PRIMARY KEY,
    table_name  VARCHAR(50) NOT NULL,
    operation   VARCHAR(10) NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE','ALERT')),
    record_id   TEXT,
    old_data    JSONB,
    new_data    JSONB,
    changed_by  TEXT        NOT NULL DEFAULT current_user,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

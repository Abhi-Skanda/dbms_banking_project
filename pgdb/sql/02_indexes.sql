-- =====================================================================
-- 02_indexes.sql : Indexes for FK lookups, statements and reports
-- (PK and UNIQUE columns are already indexed automatically)
-- =====================================================================

CREATE INDEX idx_account_customer   ON account(customer_id);
CREATE INDEX idx_account_branch     ON account(branch_id);

-- statement lookups: "last N transactions of account X"
CREATE INDEX idx_txn_from_time      ON transactions(from_account_id, txn_time DESC);
CREATE INDEX idx_txn_to_time        ON transactions(to_account_id,   txn_time DESC);
CREATE INDEX idx_txn_time           ON transactions(txn_time);

CREATE INDEX idx_loan_customer      ON loan(customer_id);
CREATE INDEX idx_loan_payment_loan  ON loan_payment(loan_id);
CREATE INDEX idx_employee_branch    ON employee(branch_id);
CREATE INDEX idx_card_account       ON card(account_id);
CREATE INDEX idx_audit_table_time   ON audit_log(table_name, changed_at DESC);

-- partial index: only active loans are queried often
CREATE INDEX idx_loan_active        ON loan(branch_id) WHERE status = 'ACTIVE';

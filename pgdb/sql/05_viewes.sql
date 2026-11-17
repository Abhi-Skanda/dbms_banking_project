-- =====================================================================
-- 05_views.sql : Reusable read-only reports
-- =====================================================================

-- Account + owner + branch in one place (3-table JOIN)
CREATE OR REPLACE VIEW vw_account_summary AS
SELECT a.account_id, a.account_number, a.account_type, a.balance, a.status,
       c.customer_id, c.full_name AS customer_name, c.phone,
       b.branch_id, b.branch_name, b.city
FROM account a
JOIN customer c ON c.customer_id = a.customer_id
JOIN branch   b ON b.branch_id   = a.branch_id;

-- Statement: each transaction from the viewpoint of one account,
-- with a running balance (window function).
CREATE OR REPLACE VIEW vw_account_statement AS
SELECT account_id, txn_id, txn_time, txn_type, description, direction, amount,
       SUM(signed_amount) OVER (PARTITION BY account_id ORDER BY txn_time, txn_id) AS running_balance
FROM (
    SELECT from_account_id AS account_id, txn_id, txn_time, txn_type, description,
           'DEBIT'::text AS direction, amount, -amount AS signed_amount
    FROM transactions WHERE from_account_id IS NOT NULL
    UNION ALL
    SELECT to_account_id, txn_id, txn_time, txn_type, description,
           'CREDIT'::text, amount, amount
    FROM transactions WHERE to_account_id IS NOT NULL
) t;

-- Branch dashboard (aggregates in subqueries so joins don't multiply rows)
CREATE OR REPLACE VIEW vw_branch_summary AS
SELECT b.branch_id, b.branch_name, b.city,
       COALESCE(a.total_accounts, 0)  AS total_accounts,
       COALESCE(a.total_deposits, 0)  AS total_deposits,
       COALESCE(l.active_loans, 0)    AS active_loans,
       COALESCE(l.loan_principal, 0)  AS loan_principal
FROM branch b
LEFT JOIN (SELECT branch_id, COUNT(*) AS total_accounts, SUM(balance) AS total_deposits
           FROM account WHERE status <> 'CLOSED' GROUP BY branch_id) a ON a.branch_id = b.branch_id
LEFT JOIN (SELECT branch_id, COUNT(*) AS active_loans, SUM(principal) AS loan_principal
           FROM loan WHERE status = 'ACTIVE' GROUP BY branch_id) l ON l.branch_id = b.branch_id;

-- Loan progress
CREATE OR REPLACE VIEW vw_loan_outstanding AS
SELECT l.loan_id, c.full_name AS customer_name, l.principal, l.interest_rate,
       l.tenure_months, l.emi_amount, l.status,
       COUNT(p.payment_id)                         AS emis_paid,
       COALESCE(SUM(p.amount), 0)                  AS total_paid,
       l.emi_amount * l.tenure_months              AS total_payable,
       l.emi_amount * l.tenure_months - COALESCE(SUM(p.amount), 0) AS outstanding
FROM loan l
JOIN customer c ON c.customer_id = l.customer_id
LEFT JOIN loan_payment p ON p.loan_id = l.loan_id
GROUP BY l.loan_id, c.full_name;

-- Customers ranked by total balance across all their accounts
CREATE OR REPLACE VIEW vw_top_customers AS
SELECT c.customer_id, c.full_name,
       COUNT(a.account_id)              AS accounts,
       COALESCE(SUM(a.balance), 0)      AS total_balance,
       DENSE_RANK() OVER (ORDER BY COALESCE(SUM(a.balance), 0) DESC) AS rank
FROM customer c
LEFT JOIN account a ON a.customer_id = c.customer_id AND a.status <> 'CLOSED'
GROUP BY c.customer_id, c.full_name;

-- =====================================================================
-- demo_queries.sql : Run these in psql / pgAdmin during your demo.
-- (Not executed by setup; copy-paste what you want to show.)
-- =====================================================================

-- 1. JOIN (3 tables)
SELECT c.full_name, a.account_number, a.account_type, a.balance, b.branch_name
FROM customer c JOIN account a ON a.customer_id = c.customer_id
                JOIN branch  b ON b.branch_id   = a.branch_id
ORDER BY c.full_name;

-- 2. LEFT JOIN: customers with no account
SELECT c.customer_id, c.full_name
FROM customer c LEFT JOIN account a ON a.customer_id = c.customer_id
WHERE a.account_id IS NULL;

-- 3. GROUP BY + HAVING: branches holding more than 1 lakh
SELECT b.branch_name, COUNT(*) AS accounts, SUM(a.balance) AS total
FROM branch b JOIN account a USING (branch_id)
GROUP BY b.branch_name HAVING SUM(a.balance) > 100000
ORDER BY total DESC;

-- 4. Subquery: accounts with balance above the bank-wide average
SELECT account_number, balance FROM account
WHERE balance > (SELECT AVG(balance) FROM account);

-- 5. Correlated subquery / EXISTS: customers who have an active loan
SELECT full_name FROM customer c
WHERE EXISTS (SELECT 1 FROM loan l WHERE l.customer_id = c.customer_id AND l.status = 'ACTIVE');

-- 6. Window function: rank accounts inside each branch
SELECT branch_id, account_number, balance,
       RANK() OVER (PARTITION BY branch_id ORDER BY balance DESC) AS branch_rank
FROM account;

-- 7. CTE: monthly transaction volume by type
WITH monthly AS (
    SELECT date_trunc('month', txn_time) AS month, txn_type, SUM(amount) AS volume, COUNT(*) AS n
    FROM transactions GROUP BY 1, 2
)
SELECT to_char(month, 'Mon YYYY') AS month, txn_type, n, volume FROM monthly ORDER BY month, txn_type;

-- 8. Set operation: customers holding BOTH savings and current accounts
SELECT customer_id FROM account WHERE account_type = 'SAVINGS'
INTERSECT
SELECT customer_id FROM account WHERE account_type = 'CURRENT';

-- 9. Self join: employee and their manager
SELECT e.full_name AS employee, m.full_name AS manager
FROM employee e LEFT JOIN employee m ON m.employee_id = e.manager_id;

-- 10. Views
SELECT * FROM vw_account_statement WHERE account_id = 1 ORDER BY txn_id;   -- mini statement
SELECT * FROM vw_branch_summary;
SELECT * FROM vw_loan_outstanding;
SELECT * FROM vw_top_customers ORDER BY rank;

-- 11. Stored functions
SELECT fn_calculate_emi(500000, 9.5, 24);
SELECT fn_transfer(1, 2, 1000, 'Self-owned transfer');
SELECT fn_apply_monthly_interest(4.0);              -- returns number of accounts credited

-- 12. ACID demo: failed transfer rolls back completely
SELECT account_id, balance FROM account WHERE account_id IN (1, 3);
SELECT fn_transfer(1, 3, 99999999, 'Too much');     -- ERROR: Insufficient funds
SELECT account_id, balance FROM account WHERE account_id IN (1, 3);   -- unchanged

-- 13. Manual transaction with SAVEPOINT
BEGIN;
  UPDATE account SET balance = balance - 500 WHERE account_id = 1;
  SAVEPOINT before_credit;
  UPDATE account SET balance = balance + 500 WHERE account_id = 999;  -- no such row (0 rows)
  ROLLBACK TO before_credit;                                            -- undo only the 2nd step
ROLLBACK;                                                               -- undo everything

-- 14. Constraint / trigger demos (each should fail)
UPDATE account SET balance = -10 WHERE account_id = 1;                  -- CHECK constraint
UPDATE transactions SET amount = 1 WHERE txn_id = 1;                    -- immutable ledger trigger
DELETE FROM transactions WHERE txn_id = 1;                              -- immutable ledger trigger
INSERT INTO customer (full_name,email,phone,dob)
VALUES ('Kid','kid@example.com','9000000001', CURRENT_DATE - INTERVAL '10 years'); -- age trigger

-- 15. Audit log (JSONB)
SELECT log_id, table_name, operation, record_id,
       old_data ->> 'balance' AS old_balance, new_data ->> 'balance' AS new_balance, changed_at
FROM audit_log WHERE table_name = 'account' ORDER BY log_id DESC LIMIT 10;

SELECT * FROM audit_log WHERE operation = 'ALERT';                      -- high-value alerts

-- 16. Index in action
EXPLAIN ANALYZE
SELECT * FROM transactions WHERE from_account_id = 1 ORDER BY txn_time DESC LIMIT 5;

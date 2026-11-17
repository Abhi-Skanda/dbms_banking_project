-- =====================================================================
-- 06_seed.sql : Sample data. Money is added ONLY through the functions,
-- so the ledger always matches account balances.
-- (Assumes a fresh DB so SERIAL ids start at 1.)
-- =====================================================================

INSERT INTO branch (branch_name, ifsc_code, city, address) VALUES
 ('Hubballi Main',   'DBMS0000001', 'Hubballi',  'Club Road, Hubballi'),
 ('Dharwad Central', 'DBMS0000002', 'Dharwad',   'Court Circle, Dharwad'),
 ('Bengaluru MG Rd', 'DBMS0000003', 'Bengaluru', 'MG Road, Bengaluru'),
 ('Mumbai Fort',     'DBMS0000004', 'Mumbai',    'Fort, Mumbai');

INSERT INTO employee (branch_id, manager_id, full_name, role, salary, hire_date) VALUES
 (1, NULL, 'Ramesh Kulkarni', 'Branch Manager', 120000, '2015-04-01'),
 (1, 1,    'Anita Patil',     'Cashier',         45000, '2020-06-15'),
 (1, 1,    'Sunil Desai',     'Loan Officer',    65000, '2018-09-10'),
 (2, NULL, 'Meena Joshi',     'Branch Manager', 115000, '2016-01-20'),
 (2, 4,    'Vikas Naik',      'Cashier',         42000, '2021-03-05'),
 (3, NULL, 'Priya Rao',       'Branch Manager', 130000, '2014-11-11'),
 (4, NULL, 'Arjun Mehta',     'Branch Manager', 140000, '2013-07-07');

INSERT INTO customer (full_name, email, phone, dob, address, kyc_verified) VALUES
 ('Rahul Sharma',   'rahul@example.com',   '9876543210', '1998-05-14', 'Vidyanagar, Hubballi', TRUE),
 ('Sneha Patil',    'sneha@example.com',   '9123456780', '2000-11-02', 'Saptapur, Dharwad',    TRUE),
 ('Amit Verma',     'amit@example.com',    '9988776655', '1990-03-21', 'Indiranagar, Bengaluru', TRUE),
 ('Kavya Nair',     'kavya@example.com',   '9090909090', '1995-08-30', 'Andheri, Mumbai',      TRUE),
 ('Farhan Sheikh',  'farhan@example.com',  '8887776665', '1987-01-12', 'Keshwapur, Hubballi',  FALSE),
 ('Divya Hegde',    'divya@example.com',   '7012345678', '2001-07-19', 'Gokul Road, Hubballi', TRUE);   -- no account yet

-- account_id: 1..7
INSERT INTO account (customer_id, branch_id, account_type) VALUES
 (1, 1, 'SAVINGS'),   -- 1 Rahul
 (1, 1, 'CURRENT'),   -- 2 Rahul
 (2, 2, 'SAVINGS'),   -- 3 Sneha
 (3, 3, 'SAVINGS'),   -- 4 Amit
 (3, 3, 'CURRENT'),   -- 5 Amit
 (4, 4, 'SAVINGS'),   -- 6 Kavya
 (5, 1, 'SAVINGS');   -- 7 Farhan

INSERT INTO card (account_id, card_number, card_type, expiry_date) VALUES
 (1, '4111111111111111', 'DEBIT',  '2030-12-31'),
 (3, '4222222222222222', 'DEBIT',  '2029-06-30'),
 (4, '5333333333333333', 'CREDIT', '2031-03-31');

-- Opening deposits and activity (all go through functions => ledger + audit stay consistent)
SELECT fn_deposit(1, 150000, 'Opening deposit');
SELECT fn_deposit(2,  50000, 'Opening deposit');
SELECT fn_deposit(3,  80000, 'Opening deposit');
SELECT fn_deposit(4, 250000, 'Opening deposit');
SELECT fn_deposit(5, 120000, 'Opening deposit');
SELECT fn_deposit(6, 300000, 'Opening deposit');
SELECT fn_deposit(7,  20000, 'Opening deposit');

SELECT fn_transfer(1, 3, 5000,  'Rent share');
SELECT fn_transfer(4, 6, 25000, 'Invoice payment');
SELECT fn_transfer(6, 1, 10000, 'Refund');
SELECT fn_withdraw(3, 2000, 'ATM withdrawal');
SELECT fn_withdraw(5, 15000, 'Cheque encashment');

-- Loans: one active with EMIs paid, one pending
SELECT fn_apply_for_loan(1, 1, 500000, 9.5, 24);  -- loan 1
SELECT fn_approve_loan(1);
SELECT fn_pay_emi(1);
SELECT fn_pay_emi(1);
SELECT fn_apply_for_loan(3, 4, 1200000, 8.75, 60); -- loan 2 (pending)

-- Show off the high-value ALERT trigger
SELECT fn_deposit(6, 2500000, 'Property sale proceeds');

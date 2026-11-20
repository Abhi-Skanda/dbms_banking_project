// All raw-SQL data access. API routes never write SQL themselves.
// NOTE: pg returns NUMERIC / BIGINT as strings (keeps precision). Format on the UI.
import type { QueryResultRow } from 'pg';
import { query } from '../client';

// Every write goes through write(): it runs as the signed-in user so triggers can audit WHO did it
const write = <T extends QueryResultRow = any>(text: string, params: unknown[] = []) => query<T>(text, params, true);

const first = async <T>(p: Promise<T[]>): Promise<T | null> => (await p)[0] ?? null;

// ======================= Branches & employees ==========================
export const listBranches = () => query(`SELECT * FROM branch ORDER BY branch_id`);

export const listEmployees = (branchId: number | null) =>
  query(
    `SELECT e.employee_id, e.full_name, e.role, e.salary, e.hire_date,
            b.branch_id, b.branch_name, m.full_name AS manager_name
     FROM employee e
     JOIN branch b ON b.branch_id = e.branch_id
     LEFT JOIN employee m ON m.employee_id = e.manager_id          -- self join
     WHERE ($1::int IS NULL OR e.branch_id = $1)
     ORDER BY e.employee_id`,
    [branchId]
  );

// ============================ Customers ================================
export const listCustomers = (search: string | null) =>
  query(
    `SELECT * FROM customer
     WHERE $1::text IS NULL OR full_name ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%'
     ORDER BY customer_id`,
    [search]
  );

export const getCustomer = (id: number) => first(query(`SELECT * FROM customer WHERE customer_id = $1`, [id]));

export const createCustomer = (c: { fullName: string; email: string; phone: string; dob: string; address: string | null }) =>
  first(
    write(
      `INSERT INTO customer (full_name, email, phone, dob, address)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [c.fullName, c.email, c.phone, c.dob, c.address]
    )
  );

export const updateCustomer = (
  id: number,
  c: { fullName: string | null; email: string | null; phone: string | null; dob: string | null;
       address: string | null; kycVerified: boolean | null }
) =>
  first(
    write(
      `UPDATE customer SET
         full_name    = COALESCE($2, full_name),
         email        = COALESCE($3, email),
         phone        = COALESCE($4, phone),
         dob          = COALESCE($5::date, dob),
         address      = COALESCE($6, address),
         kyc_verified = COALESCE($7::boolean, kyc_verified)
       WHERE customer_id = $1 RETURNING *`,
      [id, c.fullName, c.email, c.phone, c.dob, c.address, c.kycVerified]
    )
  );

// Fails with a foreign-key error if the customer still has accounts (ON DELETE RESTRICT)
export const deleteCustomer = (id: number) =>
  first(write(`DELETE FROM customer WHERE customer_id = $1 RETURNING customer_id`, [id]));

// ============================= Accounts ================================
export const listAccounts = (customerId: number | null) =>
  query(
    `SELECT * FROM vw_account_summary
     WHERE $1::int IS NULL OR customer_id = $1 ORDER BY account_id`,
    [customerId]
  );

export const getAccount = (id: number) => first(query(`SELECT * FROM vw_account_summary WHERE account_id = $1`, [id]));

export const openAccount = (customerId: number, branchId: number, type: string) =>
  first(
    write(
      `INSERT INTO account (customer_id, branch_id, account_type)
       VALUES ($1, $2, $3) RETURNING account_id`,
      [customerId, branchId, type]
    )
  ).then((r) => getAccount((r as { account_id: number }).account_id));

export const setAccountStatus = async (id: number, status: string) => {
  const r = await first(write(`UPDATE account SET status = $2 WHERE account_id = $1 RETURNING account_id`, [id, status]));
  return r ? getAccount(id) : null;
};

export const accountStatement = (id: number, limit: number, from: string | null, to: string | null) =>
  query(
    `SELECT * FROM vw_account_statement
     WHERE account_id = $1
       AND ($3::timestamptz IS NULL OR txn_time >= $3)
       AND ($4::timestamptz IS NULL OR txn_time <  $4)
     ORDER BY txn_time DESC, txn_id DESC LIMIT $2`,
    [id, limit, from, to]
  );

// =========================== Transactions ==============================
const balancesOf = (ids: number[]) =>
  query(`SELECT account_id, account_number, balance FROM account WHERE account_id = ANY($1::int[]) ORDER BY account_id`, [ids]);

export const getTransaction = (id: string | number) =>
  first(
    query(
      `SELECT t.*, fa.account_number AS from_account_number, ta.account_number AS to_account_number
       FROM transactions t
       LEFT JOIN account fa ON fa.account_id = t.from_account_id
       LEFT JOIN account ta ON ta.account_id = t.to_account_id
       WHERE t.txn_id = $1`,
      [id]
    )
  );

export const listTransactions = (accountId: number | null, limit: number, customerId: number | null = null) =>
  query(
    `SELECT t.*, fa.account_number AS from_account_number, ta.account_number AS to_account_number
     FROM transactions t
     LEFT JOIN account fa ON fa.account_id = t.from_account_id
     LEFT JOIN account ta ON ta.account_id = t.to_account_id
     WHERE ($1::int IS NULL OR t.from_account_id = $1 OR t.to_account_id = $1)
       AND ($3::int IS NULL OR fa.customer_id = $3 OR ta.customer_id = $3)   -- customers: own accounts only
     ORDER BY t.txn_id DESC LIMIT $2`,
    [accountId, limit, customerId]
  );

// The DB functions do all validation + locking and throw on failure (=> automatic rollback)
const finish = async (txnId: string, accountIds: number[]) => ({
  transaction: await getTransaction(txnId),
  accounts: await balancesOf(accountIds),
});

export const deposit = async (accountId: number, amount: number, desc: string | null) => {
  const r = await first<{ txn_id: string }>(
    write(`SELECT fn_deposit($1, $2, COALESCE($3::text, 'Cash deposit')) AS txn_id`, [accountId, amount, desc])
  );
  return finish(r!.txn_id, [accountId]);
};

export const withdraw = async (accountId: number, amount: number, desc: string | null) => {
  const r = await first<{ txn_id: string }>(
    write(`SELECT fn_withdraw($1, $2, COALESCE($3::text, 'Cash withdrawal')) AS txn_id`, [accountId, amount, desc])
  );
  return finish(r!.txn_id, [accountId]);
};

export const transfer = async (from: number, to: number, amount: number, desc: string | null) => {
  const r = await first<{ txn_id: string }>(
    write(`SELECT fn_transfer($1, $2, $3, COALESCE($4::text, 'Fund transfer')) AS txn_id`, [from, to, amount, desc])
  );
  return finish(r!.txn_id, [from, to]);
};

// =============================== Cards =================================
export const listCards = (accountId: number | null, customerId: number | null = null) =>
  query(
    `SELECT c.card_id, c.account_id, a.account_number,
            '************' || right(c.card_number, 4) AS masked_number,
            c.card_type, c.expiry_date, c.status
     FROM card c JOIN account a ON a.account_id = c.account_id
     WHERE ($1::int IS NULL OR c.account_id = $1) AND ($2::int IS NULL OR a.customer_id = $2)
     ORDER BY c.card_id`,
    [accountId, customerId]
  );

export const issueCard = (accountId: number, type: string) =>
  first(
    write(
      `INSERT INTO card (account_id, card_number, card_type, expiry_date)
       VALUES ($1, '4' || lpad(floor(random() * 1e15)::bigint::text, 15, '0'), $2,
               (CURRENT_DATE + INTERVAL '5 years')::date)
       RETURNING *`,
      [accountId, type]
    )
  );

export const setCardStatus = (id: number, status: string) =>
  first(write(`UPDATE card SET status = $2 WHERE card_id = $1 RETURNING card_id, account_id, card_type, expiry_date, status`, [id, status]));

// ============================== Loans ==================================
const LOAN_SELECT = `
  SELECT l.loan_id, l.customer_id, v.customer_name, l.account_id, l.branch_id,
         l.principal, l.interest_rate, l.tenure_months, l.emi_amount, l.status,
         l.applied_on, l.start_date,
         v.emis_paid::int AS emis_paid, v.total_paid, v.total_payable, v.outstanding
  FROM loan l JOIN vw_loan_outstanding v ON v.loan_id = l.loan_id`;

export const listLoans = (status: string | null, customerId: number | null) =>
  query(
    `${LOAN_SELECT}
     WHERE ($1::loan_status IS NULL OR l.status = $1) AND ($2::int IS NULL OR l.customer_id = $2)
     ORDER BY l.loan_id`,
    [status, customerId]
  );

export const getLoan = async (id: number) => {
  const loan = await first(query(`${LOAN_SELECT} WHERE l.loan_id = $1`, [id]));
  if (!loan) return null;
  const payments = await query(`SELECT * FROM loan_payment WHERE loan_id = $1 ORDER BY payment_id`, [id]);
  return { ...loan, payments };
};

export const calculateEmi = (principal: number, rate: number, months: number) =>
  first(query(`SELECT fn_calculate_emi($1::numeric, $2::numeric, $3::int) AS emi`, [principal, rate, months]));

export const applyForLoan = async (customerId: number, accountId: number, principal: number, rate: number, months: number) => {
  const r = await first<{ loan_id: number }>(
    write(`SELECT fn_apply_for_loan($1, $2, $3, $4, $5) AS loan_id`, [customerId, accountId, principal, rate, months])
  );
  return getLoan(r!.loan_id);
};

export const approveLoan = async (id: number) => {
  const r = await first<{ txn_id: string }>(write(`SELECT fn_approve_loan($1) AS txn_id`, [id]));
  return { loan: await getLoan(id), disbursal: await getTransaction(r!.txn_id) };
};

export const rejectLoan = async (id: number) => {
  await write(`SELECT fn_reject_loan($1)`, [id]);
  return getLoan(id);
};

export const payEmi = async (id: number) => {
  const r = await first<{ txn_id: string }>(write(`SELECT fn_pay_emi($1) AS txn_id`, [id]));
  return { loan: await getLoan(id), payment: await getTransaction(r!.txn_id) };
};

// ============================ Reports etc. =============================
export const dashboardStats = () =>
  first(
    query(`SELECT
      (SELECT COUNT(*)::int FROM customer)                                   AS customers,
      (SELECT COUNT(*)::int FROM account WHERE status <> 'CLOSED')           AS accounts,
      (SELECT COALESCE(SUM(balance), 0) FROM account WHERE status <> 'CLOSED') AS total_deposits,
      (SELECT COUNT(*)::int FROM loan WHERE status = 'ACTIVE')               AS active_loans,
      (SELECT COUNT(*)::int FROM loan WHERE status = 'PENDING')              AS pending_loans,
      (SELECT COUNT(*)::int FROM transactions WHERE txn_time >= CURRENT_DATE) AS transactions_today`)
  );

export const branchSummary = () => query(`SELECT branch_id, branch_name, city, total_accounts::int AS total_accounts, total_deposits,
                  active_loans::int AS active_loans, loan_principal
           FROM vw_branch_summary ORDER BY total_deposits DESC`);

export const topCustomers = (n: number) => query(`SELECT customer_id, full_name, accounts::int AS accounts, total_balance, rank::int AS rank
           FROM vw_top_customers ORDER BY rank, customer_id LIMIT $1`, [n]);

export const monthlyVolume = () =>
  query(
    `WITH monthly AS (
       SELECT date_trunc('month', txn_time) AS m, txn_type, COUNT(*) AS n, SUM(amount) AS volume
       FROM transactions GROUP BY 1, 2
     )
     SELECT to_char(m, 'YYYY-MM') AS month, txn_type, n::int AS count, volume
     FROM monthly ORDER BY m, txn_type`
  );

export const auditLog = (table: string | null, operation: string | null, limit: number) =>
  query(
    `SELECT * FROM audit_log
     WHERE ($1::text IS NULL OR table_name = $1) AND ($2::text IS NULL OR operation = $2)
     ORDER BY log_id DESC LIMIT $3`,
    [table, operation, limit]
  );

export const applyMonthlyInterest = (rate: number) =>
  first(write(`SELECT fn_apply_monthly_interest($1::numeric) AS accounts_credited`, [rate]));

// ===================== Ownership lookups (for permission checks) =======
const ownerOf = async (sql: string, id: number) =>
  (await first<{ customer_id: number }>(query(sql, [id])))?.customer_id ?? null;

export const accountOwnerId = (id: number) => ownerOf(`SELECT customer_id FROM account WHERE account_id = $1`, id);
export const loanOwnerId = (id: number) => ownerOf(`SELECT customer_id FROM loan WHERE loan_id = $1`, id);
export const cardOwnerId = (id: number) =>
  ownerOf(`SELECT a.customer_id FROM card c JOIN account a ON a.account_id = c.account_id WHERE c.card_id = $1`, id);

export const accountIdByNumber = async (accountNumber: string) =>
  (await first<{ account_id: number }>(query(`SELECT account_id FROM account WHERE account_number = $1`, [accountNumber])))?.account_id ?? null;

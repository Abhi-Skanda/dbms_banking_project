// Shapes returned by the API. NUMERIC/BIGINT columns arrive as strings (precision-safe).
export type Branch = { branch_id: number; branch_name: string; ifsc_code: string; city: string; address: string | null };

export type Employee = {
  employee_id: number; full_name: string; role: string; salary: string; hire_date: string;
  branch_id: number; branch_name: string; manager_name: string | null;
};

export type Customer = {
  customer_id: number; full_name: string; email: string; phone: string; dob: string;
  address: string | null; kyc_verified: boolean; created_at: string;
};

export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';

export type Account = {
  account_id: number; account_number: string; account_type: 'SAVINGS' | 'CURRENT'; balance: string;
  status: AccountStatus; customer_id: number; customer_name: string; phone: string;
  branch_id: number; branch_name: string; city: string;
};

export type Txn = {
  txn_id: string; txn_type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';
  from_account_id: number | null; to_account_id: number | null; amount: string;
  description: string | null; txn_time: string;
  from_account_number: string | null; to_account_number: string | null;
};

export type TxnResult = {
  transaction: Txn;
  accounts: { account_id: number; account_number: string; balance: string }[];
};

export type StatementEntry = {
  account_id: number; txn_id: string; txn_time: string; txn_type: string; description: string | null;
  direction: 'DEBIT' | 'CREDIT'; amount: string; running_balance: string;
};

export type LoanPayment = { payment_id: number; loan_id: number; txn_id: string; amount: string; paid_on: string };

export type Loan = {
  loan_id: number; customer_id: number; customer_name: string; account_id: number; branch_id: number;
  principal: string; interest_rate: string; tenure_months: number; emi_amount: string;
  status: 'PENDING' | 'ACTIVE' | 'CLOSED' | 'REJECTED';
  applied_on: string; start_date: string | null;
  emis_paid: number; total_paid: string; total_payable: string; outstanding: string;
  payments?: LoanPayment[];
};

export type Card = {
  card_id: number; account_id: number; account_number: string; masked_number: string;
  card_type: 'DEBIT' | 'CREDIT'; expiry_date: string; status: 'ACTIVE' | 'BLOCKED' | 'EXPIRED';
};

export type AuditEntry = {
  log_id: string; table_name: string; operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'ALERT';
  record_id: string | null; old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null;
  changed_by: string; changed_at: string;
};

export type DashboardStats = {
  customers: number; accounts: number; total_deposits: string; active_loans: number;
  pending_loans: number; transactions_today: number;
};

export type BranchSummary = {
  branch_id: number; branch_name: string; city: string; total_accounts: number;
  total_deposits: string; active_loans: number; loan_principal: string;
};

export type TopCustomer = { customer_id: number; full_name: string; accounts: number; total_balance: string; rank: number };

export type MonthlyVolume = { month: string; txn_type: string; count: number; volume: string };

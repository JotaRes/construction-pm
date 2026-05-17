export interface SPV { id: number; code: string; name: string; notes?: string }
export interface Account {
  id: number; code: string; name: string; bank: string; spvId?: number; spv?: SPV;
  initialBalance: number; reportedBalance: number; currentBalance?: number; balanceDiff?: number;
  yearsActive?: string; type?: string; active: boolean; notes?: string;
}
export interface Partner { id: number; code: string; fullName: string; email?: string }
export interface Lender { id: number; name: string; type?: string; contactName?: string }
export interface Provider { id: number; name: string; type?: string; phone?: string; email?: string }
export interface ExpenseCategory { id: number; code: string; name: string; group?: string; isCorporate: boolean }
export interface IncomeOrigin { id: number; code: string; name: string }
export interface Project {
  id: number; code: string; name: string; line?: string; model?: string; status: string;
  spvId?: number; spv?: SPV; address?: string;
  purchasePrice: number; arv: number; expectedCost: number; cashIn: number;
  notes?: string; _count?: { movements: number; loans: number; documents: number };
}
export interface Movement {
  id: number; date: string; type: string; amount: number; concept: string; notes?: string;
  accountId: number; account?: Account;
  destAccountId?: number; destAccount?: Account;
  categoryId?: number; category?: ExpenseCategory;
  originId?: number; origin?: IncomeOrigin;
  providerId?: number; provider?: Provider;
  isEquity: boolean; partnerId?: number; partner?: Partner;
  isLoan: boolean; lenderId?: number; lender?: Lender; isLoanRepayment: boolean;
  projectId?: number; project?: Project;
  isIntercompany: boolean; linkedMovementId?: number;
  hasSupport: boolean; isReconciled: boolean; needsReview: boolean; reviewReason?: string;
  documents?: any[];
}
export interface CapitalContribution {
  id: number; date: string; amount: number; concept: string; origin: string;
  partnerId: number; partner?: Partner; projectId?: number; project?: Project;
}
export interface Loan {
  id: number; date: string; amount: number; concept: string; lenderId: number; lender?: Lender;
  projectId?: number; project?: Project; interestRate?: number; termMonths?: number;
  status: string; classification?: string; totalRepaid: number; outstanding?: number;
}
export interface Catalogs {
  spvs: SPV[]; accounts: Account[]; partners: Partner[]; lenders: Lender[];
  providers: Provider[]; categories: ExpenseCategory[]; origins: IncomeOrigin[];
  projects: Project[];
}

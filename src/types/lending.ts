export interface LoanTerms {
  principal: number;
  interestRate: number;
  durationDays: number;
}

export interface LoanSummary {
  id: string;
  cardName: string;
  cardImageUrl?: string;
  grade: number;
  gradingCompany: string;
  principal: number;
  interestRate: number;
  durationDays: number;
  status: string;
  dueDate?: string;
}

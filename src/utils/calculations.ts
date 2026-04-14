/**
 * Calculates the final balance based on the provided formula:
 * A = P × (1 + r/n)^(n×t)
 * 
 * @param P Total deposited money
 * @param annualRate Annual interest rate (as a percentage, e.g., 5 for 5%)
 * @param durationMonths Duration in months
 * @returns { finalBalance: number, interestEarned: number }
 */
export const calculateInterest = (P: number, annualRate: number, durationMonths: number) => {
  if (P <= 0 || annualRate <= 0 || durationMonths <= 0) {
    return { finalBalance: P, interestEarned: 0 };
  }

  const r = annualRate / 100;
  const n = 12; // monthly compounding
  const t = durationMonths / 12; // time in years

  // A = P * (1 + r/n)^(n*t)
  const finalBalance = P * Math.pow(1 + r / n, n * t);
  const interestEarned = finalBalance - P;

  return {
    finalBalance: Math.round(finalBalance * 100) / 100,
    interestEarned: Math.round(interestEarned * 100) / 100,
  };
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency: 'BDT',
    currencyDisplay: 'narrowSymbol',
  }).format(amount);
};

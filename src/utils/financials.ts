import { Member, Settings, Transaction } from '../hooks/useData';

/**
 * Gets the expected monthly contribution for a specific month based on history.
 */
export const getExpectedMonthlyAmount = (member: Member, month: string, settings?: Settings): number => {
  if (member.monthlyContributionHistory && member.monthlyContributionHistory.length > 0) {
    // Sort history by startMonth descending to find the latest applicable one
    const sortedHistory = [...member.monthlyContributionHistory].sort((a, b) => b.startMonth.localeCompare(a.startMonth));
    
    const applicable = sortedHistory.find(h => h.startMonth <= month);
    if (applicable) {
      return applicable.amount;
    }

    // If the month is earlier than the earliest entry in history,
    // preserve historical data by returning the earliest recorded amount (e.g. 1000 tk),
    // NEVER the newer increased monthlyContribution (2000 tk)!
    const earliest = sortedHistory[sortedHistory.length - 1];
    if (earliest) {
      return earliest.amount;
    }
  }

  // Fallback if no history exists:
  // Before running month (2026-09 or settings.monthlyIncreaseEffectiveMonth), deposit was 1000 tk.
  const effectiveMonth = settings?.monthlyIncreaseEffectiveMonth || '2026-09';
  const oldAmount = settings?.monthlyOldAmount ?? 1000;
  if (month < effectiveMonth) {
    return oldAmount;
  }

  return member.monthlyContribution || (settings?.monthlyNewAmount ?? 2000);
};

/**
 * Gets the expected yearly deposit amount for a specific month based on history.
 */
export const getExpectedYearlyAmount = (member: Member, month: string): number => {
  if (!member.yearlyDepositHistory || member.yearlyDepositHistory.length === 0) {
    return member.yearlyFixedDeposit;
  }

  const sortedHistory = [...member.yearlyDepositHistory].sort((a, b) => b.startMonth.localeCompare(a.startMonth));
  const applicable = sortedHistory.find(h => h.startMonth <= month);
  if (applicable) {
    return applicable.amount;
  }

  const earliest = sortedHistory[sortedHistory.length - 1];
  return earliest ? earliest.amount : member.yearlyFixedDeposit;
};

/**
 * Calculates total expected monthly contribution from group start date to endMonth.
 */
export const getTotalExpectedMonthly = (member: Member, settings: Settings, endMonth: string): number => {
  if (!settings.startDate) return 0;
  
  const months = [];
  let current = new Date(settings.startDate + '-01');
  const end = new Date(endMonth + '-01');
  
  while (current <= end) {
    months.push(current.toISOString().slice(0, 7));
    current.setMonth(current.getMonth() + 1);
  }
  
  return months.reduce((sum, m) => sum + getExpectedMonthlyAmount(member, m, settings), 0);
};

/**
 * Determines which yearly cycle a month belongs to.
 * Returns the start month of that cycle (e.g., '2025-04').
 */
export const getYearlyCycleStart = (month: string, groupStartMonth: string): string => {
  const [startYear, startMonth] = groupStartMonth.split('-').map(Number);
  const [targetYear, targetMonth] = month.split('-').map(Number);
  
  let cycleYear = targetYear;
  if (targetMonth < startMonth) {
    cycleYear--;
  }
  
  return `${cycleYear}-${String(startMonth).padStart(2, '0')}`;
};

/**
 * Gets all yearly cycle start months from group start to current month.
 */
export const getAllYearlyCycles = (groupStartMonth: string, currentMonth: string): string[] => {
  const cycles = [];
  let current = groupStartMonth;
  while (current <= currentMonth) {
    cycles.push(current);
    const [y, m] = current.split('-').map(Number);
    current = `${y + 1}-${String(m).padStart(2, '0')}`;
  }
  return cycles;
};

/**
 * Calculates the yearly target for a specific cycle, including carryover.
 */
export const getYearlyTargetWithCarryover = (
  member: Member, 
  transactions: Transaction[], 
  settings: Settings, 
  targetCycleStart: string
): number => {
  const cycles = getAllYearlyCycles(settings.startDate, targetCycleStart);
  let carryover = 0;
  
  for (const cycleStart of cycles) {
    const [y, m] = cycleStart.split('-').map(Number);
    const cycleEnd = `${y + 1}-${String(m).padStart(2, '0')}`; // This is actually the start of next cycle
    
    // Find expected for this cycle
    const expected = getExpectedYearlyAmount(member, cycleStart);
    
    // Find paid in this cycle
    const paidInCycle = transactions
      .filter(t => t.memberId === member.id && t.type === 'yearly' && t.month >= cycleStart && t.month < cycleEnd)
      .reduce((sum, t) => sum + t.amount, 0);
    
    const targetForThisCycle = expected + carryover;
    
    if (cycleStart === targetCycleStart) {
      return targetForThisCycle;
    }
    
    carryover = Math.max(0, targetForThisCycle - paidInCycle);
  }
  
  return member.yearlyFixedDeposit; // Fallback
};

/**
 * Calculates total paid towards yearly deposits for a specific cycle.
 */
export const getYearlyPaidInCycle = (
  member: Member,
  transactions: Transaction[],
  cycleStart: string
): number => {
  const [y, m] = cycleStart.split('-').map(Number);
  const cycleEnd = `${y + 1}-${String(m).padStart(2, '0')}`;
  
  return transactions
    .filter(t => t.memberId === member.id && t.type === 'yearly' && t.month >= cycleStart && t.month < cycleEnd)
    .reduce((sum, t) => sum + t.amount, 0);
};

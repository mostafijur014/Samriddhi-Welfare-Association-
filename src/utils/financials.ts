import { Member, Settings, Transaction } from '../hooks/useData';

/**
 * Gets the expected monthly contribution for a specific month based on history.
 */
export const getExpectedMonthlyAmount = (member: Member, month: string): number => {
  if (!member.monthlyContributionHistory || member.monthlyContributionHistory.length === 0) {
    return member.monthlyContribution;
  }

  // Sort history by startMonth descending to find the latest applicable one
  const sortedHistory = [...member.monthlyContributionHistory].sort((a, b) => b.startMonth.localeCompare(a.startMonth));
  
  const applicable = sortedHistory.find(h => h.startMonth <= month);
  return applicable ? applicable.amount : member.monthlyContribution;
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
  return applicable ? applicable.amount : member.yearlyFixedDeposit;
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
  
  return months.reduce((sum, m) => sum + getExpectedMonthlyAmount(member, m), 0);
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

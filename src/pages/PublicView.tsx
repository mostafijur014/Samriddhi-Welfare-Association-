import React, { useState, useEffect } from 'react';
import { useData } from '../hooks/useData';
import { calculateInterest, formatCurrency } from '../utils/calculations';
import { Users, TrendingUp, PiggyBank, Wallet, Search, Filter, AlertTriangle, Calendar, X, Clock, Phone, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export const PublicView = () => {
  const { members, transactions, settings, loading, error } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMemberForDetails, setSelectedMemberForDetails] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [viewMonth, setViewMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getMonthsSinceStart = () => {
    if (!settings.startDate) return [];
    const start = new Date(settings.startDate + '-01');
    const now = new Date();
    const months = [];
    let current = new Date(start);
    
    while (current <= now) {
      months.push(current.toISOString().slice(0, 7));
      current.setMonth(current.getMonth() + 1);
    }
    return months.reverse(); // Newest first
  };

  const allMonths = getMonthsSinceStart();

  useEffect(() => {
    if (allMonths.length > 0 && !allMonths.includes(viewMonth)) {
      setViewMonth(allMonths[0]);
    }
  }, [allMonths, viewMonth]);

  const last3Months = allMonths.slice(0, 3).reverse(); // Oldest of last 3 first for display

  // Chart Data: Collection from group start date to current month
  const getChartMonths = () => {
    if (!settings.startDate) return [];
    
    const start = new Date(settings.startDate + '-01');
    const end = new Date();
    const months = [];
    let current = new Date(start);

    // Safety check to prevent infinite loop if dates are invalid
    let safetyCounter = 0;
    while (current <= end && safetyCounter < 120) { // Max 10 years
      months.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
      current.setMonth(current.getMonth() + 1);
      safetyCounter++;
    }
    
    return months;
  };

  const chartMonths = getChartMonths();

  const chartData = chartMonths.map(month => ({
    month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    amount: transactions
      .filter(t => t.month === month && members.some(m => m.id === t.memberId))
      .reduce((sum, t) => sum + t.amount, 0)
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-900 mb-2">Database Connection Error</h2>
          <p className="text-red-700 max-w-2xl mx-auto">{error}</p>
          <div className="mt-6 flex flex-col items-center gap-2 text-sm text-red-600">
            <p>1. Ensure the <strong>Cloud Firestore API</strong> is enabled in Google Cloud Console.</p>
            <p>2. Ensure you have <strong>created a Firestore database</strong> in the Firebase Console.</p>
          </div>
        </div>
      </div>
    );
  }

  const totalDeposited = members.reduce((sum, m) => sum + m.totalDeposited, 0);
  
  // Calculate total interest by summing individual member interests
  const memberCalculations = members.map(m => calculateInterest(
    m.totalDeposited,
    settings.interestRate,
    settings.duration
  ));
  
  const totalInterest = memberCalculations.reduce((sum, c) => sum + c.interestEarned, 0);
  const totalFinal = totalDeposited + totalInterest;

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.memberId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = [
    { label: 'Total Members', value: members.length, icon: Users, color: 'bg-blue-500' },
    { label: 'Total Deposited', value: formatCurrency(totalDeposited), icon: PiggyBank, color: 'bg-green-500' },
    { label: 'Interest Earned', value: formatCurrency(totalInterest), icon: TrendingUp, color: 'bg-amber-500' },
    { label: 'Final Balance', value: formatCurrency(totalFinal), icon: Wallet, color: 'bg-indigo-600' },
  ];

  // Logic for the 3 columns
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  // Column 1: All members and their deposit this month
  const column1Data = members.map(member => {
    const monthTransactions = transactions.filter(t => t.memberId === member.id && t.month === currentMonth);
    const paidThisMonth = monthTransactions.reduce((sum, t) => sum + t.amount, 0);
    return { ...member, paidThisMonth };
  });

  // Column 2: Who completed their deposit this month
  const column2Data = column1Data.filter(m => m.paidThisMonth >= m.monthlyContribution);

  // Column 3: Due person information (total dues across all months)
  const column3Data = members.map(member => {
    const monthsSinceStart = allMonths.length;
    const expectedTotal = monthsSinceStart * member.monthlyContribution;
    const totalDue = Math.max(0, expectedTotal - member.totalDeposited);
    return { ...member, totalDue };
  }).filter(m => m.totalDue > 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center space-x-4">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
              {settings.heroTitle || 'Savings Group Overview'}
            </h1>
            <p className="mt-1 text-lg text-gray-600">
              {settings.heroSubtitle || 'Transparent tracking of our collective growth.'}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 self-start md:self-center">
          <div className="flex items-center bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100">
            <Calendar className="w-5 h-5 text-indigo-600 mr-2" />
            <div>
              <p className="text-[10px] uppercase font-bold text-indigo-400 leading-none">Group Started</p>
              <p className="text-sm font-bold text-indigo-700">
                {settings.startDate ? new Date(settings.startDate + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'Not Set'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
            <Clock className="w-5 h-5 text-indigo-600 mr-2" />
            <div>
              <p className="text-[10px] uppercase font-bold text-gray-400 leading-none">Current Time</p>
              <p className="text-sm font-bold text-gray-700">
                {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} • {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-10">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="bg-white overflow-hidden shadow rounded-2xl border border-gray-100 p-6 flex items-center space-x-4"
          >
            <div className={`${stat.color} p-3 rounded-xl`}>
              <stat.icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 truncate">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Monthly Collection Growth Chart */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-10">
        <h3 className="text-lg font-semibold mb-6">Monthly Collection Growth</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
              <Tooltip 
                cursor={{fill: '#f9fafb'}}
                contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}}
              />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={32}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#4f46e5' : '#c7d2fe'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3-Column Status Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {/* Column 1: Monthly Deposits */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[400px]">
          <div className="bg-indigo-600 px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Monthly Deposits</h3>
            <span className="text-[10px] bg-indigo-500 text-white px-2 py-0.5 rounded-full font-bold">
              {new Date().toLocaleDateString('en-US', { month: 'short' })}
            </span>
          </div>
          <div className="p-4 overflow-y-auto flex-grow space-y-3">
            {column1Data.map(member => (
              <div key={member.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${member.paidThisMonth >= member.monthlyContribution ? 'bg-green-500' : member.paidThisMonth > 0 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                  <div>
                    <p className="text-sm font-bold text-gray-900 leading-none">{member.name}</p>
                    <p className="text-[10px] text-gray-400 font-mono mt-1">{member.memberId}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-gray-900">{formatCurrency(member.paidThisMonth)}</p>
                  <p className="text-[9px] text-gray-400 uppercase font-bold">Target: {formatCurrency(member.monthlyContribution)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Completed This Month */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[400px]">
          <div className="bg-green-600 px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Completed</h3>
            <span className="text-[10px] bg-green-500 text-white px-2 py-0.5 rounded-full font-bold">
              {column2Data.length} Members
            </span>
          </div>
          <div className="p-4 overflow-y-auto flex-grow space-y-3">
            {column2Data.length > 0 ? (
              column2Data.map(member => (
                <div key={member.id} className="flex items-center justify-between p-2 rounded-xl bg-green-50 border border-green-100">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-200 flex items-center justify-center">
                      <PiggyBank className="w-3.5 h-3.5 text-green-700" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-green-900 leading-none">{member.name}</p>
                      <p className="text-[10px] text-green-600 font-mono mt-1">{member.memberId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-green-700">{formatCurrency(member.paidThisMonth)}</p>
                    <p className="text-[9px] text-green-600 uppercase font-bold">Success</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <Clock className="w-10 h-10 text-gray-200 mb-2" />
                <p className="text-sm text-gray-400 font-medium">No completions yet this month</p>
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Outstanding Dues */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[400px]">
          <div className="bg-red-600 px-4 py-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Outstanding Dues</h3>
            <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full font-bold">
              {column3Data.length} Pending
            </span>
          </div>
          <div className="p-4 overflow-y-auto flex-grow space-y-3">
            {column3Data.length > 0 ? (
              column3Data.map(member => (
                <div key={member.id} className="flex items-center justify-between p-2 rounded-xl bg-red-50 border border-red-100">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-red-200 flex items-center justify-center">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-700" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-red-900 leading-none">{member.name}</p>
                      <p className="text-[10px] text-red-600 font-mono mt-1">{member.memberId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-red-700">{formatCurrency(member.totalDue)}</p>
                    <p className="text-[9px] text-red-600 uppercase font-bold">Total Due</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <Users className="w-10 h-10 text-green-100 mb-2" />
                <p className="text-sm text-green-600 font-medium">All members are up to date!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="mb-6 flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          <div className="relative w-full sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all"
              placeholder="Search members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="relative w-full sm:w-48">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Calendar className="h-4 w-4 text-gray-400" />
            </div>
            <select
              value={viewMonth}
              onChange={(e) => setViewMonth(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all appearance-none"
            >
              {allMonths.map(month => (
                <option key={month} value={month}>
                  {new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center text-sm text-gray-500 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
          <Filter className="w-4 h-4 mr-2 text-indigo-500" />
          <span className="font-medium text-gray-700">{filteredMembers.length}</span>
          <span className="mx-1">of</span>
          <span className="font-medium text-gray-700">{members.length}</span>
          <span className="ml-1">members</span>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Member</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Target</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Paid ({new Date(viewMonth + '-01').toLocaleDateString('en-US', { month: 'short' })})</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Monthly Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Deposited</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Final Balance</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMembers.map((member) => {
                const { finalBalance } = calculateInterest(
                  member.totalDeposited,
                  settings.interestRate,
                  settings.duration
                );
                
                const monthTransactions = transactions.filter(t => t.memberId === member.id && t.month === viewMonth);
                const totalForViewMonth = monthTransactions.reduce((sum, t) => sum + t.amount, 0);
                const isPaidInViewMonth = totalForViewMonth >= member.monthlyContribution;

                return (
                  <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">{member.name}</div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 font-mono uppercase tracking-tighter">{member.memberId}</span>
                        {member.phone && (
                          <a 
                            href={`tel:${member.phone}`}
                            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center mt-0.5"
                          >
                            {member.phone}
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(member.monthlyContribution)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-bold ${isPaidInViewMonth ? 'text-green-600' : totalForViewMonth > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {formatCurrency(totalForViewMonth)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div 
                        className="flex gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setSelectedMemberForDetails(member.id)}
                      >
                        {last3Months.map(month => {
                          const monthTransactions = transactions.filter(t => t.memberId === member.id && t.month === month);
                          const totalForMonth = monthTransactions.reduce((sum, t) => sum + t.amount, 0);
                          let bgColor = 'bg-red-500';
                          if (totalForMonth >= member.monthlyContribution) bgColor = 'bg-blue-600';
                          else if (totalForMonth > 0) bgColor = 'bg-yellow-500';
                          
                          return (
                            <div key={month} className="flex flex-col items-center">
                              <div className={`w-3 h-3 rounded-full ${bgColor}`} title={`${month}: ${formatCurrency(totalForMonth)}`} />
                              <span className="text-[8px] text-gray-400 mt-0.5">{month.split('-')[1]}/{month.split('-')[0].slice(2)}</span>
                            </div>
                          );
                        })}
                        <span className="text-[10px] text-indigo-600 font-bold ml-1 self-center">Details</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(member.totalDeposited)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 font-bold">
                      {formatCurrency(finalBalance)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        member.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {member.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredMembers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No members found matching your search.</p>
          </div>
        )}
      </div>
      {/* Member Details Modal */}
      <AnimatePresence>
        {selectedMemberForDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-indigo-600 text-white">
                <div>
                  <h3 className="text-lg font-bold">Payment History</h3>
                  <p className="text-xs text-indigo-100">
                    {members.find(m => m.id === selectedMemberForDetails)?.name} ({members.find(m => m.id === selectedMemberForDetails)?.memberId})
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedMemberForDetails(null)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                <div className="space-y-3">
                  {allMonths.map(month => {
                    const member = members.find(m => m.id === selectedMemberForDetails);
                    if (!member) return null;
                    
                    const monthTransactions = transactions.filter(t => t.memberId === member.id && t.month === month);
                    const totalForMonth = monthTransactions.reduce((sum, t) => sum + t.amount, 0);
                    
                    let statusText = 'Not Paid';
                    let statusColor = 'text-red-600 bg-red-50 border-red-100';
                    let dotColor = 'bg-red-500';
                    
                    if (totalForMonth >= member.monthlyContribution) {
                      statusText = 'Fully Paid';
                      statusColor = 'text-blue-700 bg-blue-50 border-blue-100';
                      dotColor = 'bg-blue-600';
                    } else if (totalForMonth > 0) {
                      statusText = 'Partial Payment';
                      statusColor = 'text-yellow-700 bg-yellow-50 border-yellow-100';
                      dotColor = 'bg-yellow-500';
                    }

                    return (
                      <div key={month} className={`flex items-center justify-between p-3 rounded-xl border ${statusColor}`}>
                        <div className="flex items-center">
                          <div className={`w-2.5 h-2.5 rounded-full ${dotColor} mr-3`} />
                          <div>
                            <p className="text-sm font-bold">
                              {new Date(month + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </p>
                            <p className="text-[10px] opacity-70 uppercase font-bold tracking-wider">
                              Target: {formatCurrency(member.monthlyContribution)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black">{formatCurrency(totalForMonth)}</p>
                          <p className="text-[10px] font-bold uppercase">{statusText}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-center gap-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-blue-600 mr-1" /> Paid</div>
                <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-yellow-500 mr-1" /> Partial</div>
                <div className="flex items-center"><div className="w-2 h-2 rounded-full bg-red-500 mr-1" /> Due</div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Contact Persons Section */}
      {settings.showContactPersons !== false && (settings.contactPerson1?.name || settings.contactPerson2?.name) && (
        <div className="mt-16 mb-12">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900">Contact Persons</h2>
            <p className="text-gray-500 mt-2 text-sm uppercase tracking-widest font-bold">Get in touch with our team</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Person 1 */}
            {settings.contactPerson1?.name && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 flex items-center gap-6"
              >
                <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-md ring-4 ring-indigo-50 flex-shrink-0">
                  <img 
                    src={settings.contactPerson1.imageUrl || 'https://picsum.photos/seed/person1/200/200'} 
                    alt={settings.contactPerson1.name} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 leading-tight">{settings.contactPerson1.name}</h3>
                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">{settings.contactPerson1.role}</p>
                  <div className="space-y-1">
                    <a href={`tel:${settings.contactPerson1.phone}`} className="flex items-center text-sm text-gray-600 hover:text-indigo-600 transition-colors">
                      <Phone className="w-3.5 h-3.5 mr-2" /> {settings.contactPerson1.phone}
                    </a>
                    <a href={`mailto:${settings.contactPerson1.email}`} className="flex items-center text-sm text-gray-600 hover:text-indigo-600 transition-colors">
                      <Mail className="w-3.5 h-3.5 mr-2" /> {settings.contactPerson1.email}
                    </a>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Person 2 */}
            {settings.contactPerson2?.name && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100 flex items-center gap-6"
              >
                <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-md ring-4 ring-indigo-50 flex-shrink-0">
                  <img 
                    src={settings.contactPerson2.imageUrl || 'https://picsum.photos/seed/person2/200/200'} 
                    alt={settings.contactPerson2.name} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <h3 className="text-xl font-black text-gray-900 leading-tight">{settings.contactPerson2.name}</h3>
                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-3">{settings.contactPerson2.role}</p>
                  <div className="space-y-1">
                    <a href={`tel:${settings.contactPerson2.phone}`} className="flex items-center text-sm text-gray-600 hover:text-indigo-600 transition-colors">
                      <Phone className="w-3.5 h-3.5 mr-2" /> {settings.contactPerson2.phone}
                    </a>
                    <a href={`mailto:${settings.contactPerson2.email}`} className="flex items-center text-sm text-gray-600 hover:text-indigo-600 transition-colors">
                      <Mail className="w-3.5 h-3.5 mr-2" /> {settings.contactPerson2.email}
                    </a>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

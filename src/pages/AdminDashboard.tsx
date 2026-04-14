import React, { useState, useEffect } from 'react';
import { useData, Member, Transaction } from '../hooks/useData';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp, getDocs, query, limit } from 'firebase/firestore';
import { calculateInterest, formatCurrency } from '../utils/calculations';
import { 
  Plus, Edit2, Trash2, Settings as SettingsIcon, 
  CheckCircle, XCircle, AlertCircle, Download, Save, X,
  Calendar, Clock, Phone, ChevronDown, ChevronUp,
  AlertTriangle, PiggyBank, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableMemberRow: React.FC<{ 
  member: Member, 
  transactions: Transaction[], 
  expectedMonths: number,
  onEdit: (m: Member) => void,
  onDelete: (id: string) => void
}> = ({ member, transactions, expectedMonths, onEdit, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: member.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr 
      ref={setNodeRef} 
      style={style} 
      className={`hover:bg-gray-50 transition-colors ${isDragging ? 'bg-indigo-50 shadow-inner' : ''}`}
    >
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div 
            {...attributes} 
            {...listeners} 
            className="mr-3 cursor-grab active:cursor-grabbing text-gray-400 hover:text-indigo-600"
          >
            <div className="grid grid-cols-2 gap-0.5 w-3">
              <div className="w-1 h-1 bg-current rounded-full"></div>
              <div className="w-1 h-1 bg-current rounded-full"></div>
              <div className="w-1 h-1 bg-current rounded-full"></div>
              <div className="w-1 h-1 bg-current rounded-full"></div>
              <div className="w-1 h-1 bg-current rounded-full"></div>
              <div className="w-1 h-1 bg-current rounded-full"></div>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs mr-3">
            {member.name.charAt(0)}
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">{member.name}</div>
            <div className="text-xs text-gray-500">{member.memberId}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {member.phone ? (
          <a 
            href={`tel:${member.phone}`}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
          >
            <Phone className="w-3 h-3 mr-1" /> {member.phone}
          </a>
        ) : (
          <span className="text-xs text-gray-400 italic">No phone</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {formatCurrency(member.monthlyContribution)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
        {formatCurrency(member.totalDeposited)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex flex-wrap gap-1 max-w-[150px]">
          {transactions.filter(t => t.memberId === member.id).map(t => (
            <span key={t.id} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded border border-indigo-100">
              {t.month.split('-')[1]}/{t.month.split('-')[0].slice(2)}
            </span>
          ))}
          {transactions.filter(t => t.memberId === member.id).length === 0 && (
            <span className="text-xs text-gray-400 italic">No payments</span>
          )}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        {(() => {
          const paidCount = transactions.filter(t => t.memberId === member.id).length;
          const isBehind = paidCount < expectedMonths;
          return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              !isBehind ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {isBehind ? `${expectedMonths - paidCount} Months Due` : 'Up to Date'}
            </span>
          );
        })()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex justify-end gap-2">
          <button 
            onClick={() => onEdit(member)}
            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => onDelete(member.id)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
};

export const AdminDashboard = () => {
  const { members, transactions, settings, loading, error } = useData();

  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [depositView, setDepositView] = useState<'pending' | 'completed'>('pending');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMonth, setDepositMonth] = useState(new Date().toISOString().slice(0, 7));
  const [currentTime, setCurrentTime] = useState(new Date());

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = members.findIndex((m) => m.id === active.id);
      const newIndex = members.findIndex((m) => m.id === over.id);

      const newMembers = arrayMove(members, oldIndex, newIndex);
      
      // Update local state immediately for smooth UI
      // Note: useData hook will eventually sync with Firestore, but this provides instant feedback
      
      try {
        // Update Firestore in bulk
        const updates = newMembers.map((member: Member, index) => {
          return updateDoc(doc(db, 'members', member.id), {
            order: index
          }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `members/${member.id}`));
        });
        await Promise.all(updates);
      } catch (err) {
        console.error('Error updating member order:', err);
        setStatusMessage({ type: 'error', text: 'Failed to save new order' });
      }
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  // Member Form State
  const [memberForm, setMemberForm] = useState({
    name: '',
    memberId: '',
    phone: '',
    monthlyContribution: '',
    status: 'Active' as 'Active' | 'Inactive'
  });

  // Settings Form State
  const [settingsForm, setSettingsForm] = useState({
    interestRate: 5,
    duration: 12,
    startDate: new Date().toISOString().slice(0, 7),
    announcement: '',
    showAnnouncement: false,
    announcementSpeed: 40,
    tagline1: '',
    tagline2: '',
    heroTitle: '',
    heroSubtitle: '',
    showContactPersons: true,
    contactPerson1: { name: '', role: '', phone: '', email: '', imageUrl: '' },
    contactPerson2: { name: '', role: '', phone: '', email: '', imageUrl: '' }
  });

  const [expandedSections, setExpandedSections] = useState({
    interest: true,
    announcement: false,
    branding: false,
    contact: false
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Sync settings form when data loads
  useEffect(() => {
    if (settings) {
      setSettingsForm({
        interestRate: settings.interestRate,
        duration: settings.duration,
        startDate: settings.startDate || new Date().toISOString().slice(0, 7),
        announcement: settings.announcement || '',
        showAnnouncement: settings.showAnnouncement || false,
        announcementSpeed: settings.announcementSpeed || 40,
        tagline1: settings.tagline1 || '',
        tagline2: settings.tagline2 || '',
        heroTitle: settings.heroTitle || '',
        heroSubtitle: settings.heroSubtitle || '',
        showContactPersons: settings.showContactPersons !== undefined ? settings.showContactPersons : true,
        contactPerson1: settings.contactPerson1 || { name: '', role: '', phone: '', email: '', imageUrl: '' },
        contactPerson2: settings.contactPerson2 || { name: '', role: '', phone: '', email: '', imageUrl: '' }
      });
    }
  }, [settings]);

  const getMonthsSinceStart = () => {
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

  const chartMonths = getMonthsSinceStart();
  const expectedMonths = chartMonths.length;

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
    const expectedTotal = expectedMonths * member.monthlyContribution;
    const totalDue = Math.max(0, expectedTotal - member.totalDeposited);
    return { ...member, totalDue };
  }).filter(m => m.totalDue > 0);

  // Auto-clear status message
  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>;

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
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

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: memberForm.name,
      memberId: memberForm.memberId,
      phone: memberForm.phone,
      monthlyContribution: Number(memberForm.monthlyContribution),
      status: memberForm.status,
      totalDeposited: editingMember ? editingMember.totalDeposited : 0,
      lastPaymentDate: editingMember ? editingMember.lastPaymentDate : '',
      createdAt: editingMember ? editingMember.createdAt : new Date().toISOString()
    };

    try {
      if (editingMember) {
        await updateDoc(doc(db, 'members', editingMember.id), data);
      } else {
        // Get the current max order to place the new member at the end
        const maxOrder = members.length > 0 ? Math.max(...members.map(m => m.order || 0)) : -1;
        await addDoc(collection(db, 'members'), {
          ...data,
          order: maxOrder + 1,
          createdAt: serverTimestamp()
        });
      }

      setStatusMessage({ type: 'success', text: `Member ${editingMember ? 'updated' : 'added'} successfully` });
      setIsMemberModalOpen(false);
      setEditingMember(null);
      setMemberForm({ name: '', memberId: '', phone: '', monthlyContribution: '', status: 'Active' });
    } catch (err) {
      handleFirestoreError(err, editingMember ? OperationType.UPDATE : OperationType.CREATE, editingMember ? `members/${editingMember.id}` : 'members');
    }
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete) return;
    
    try {
      await deleteDoc(doc(db, 'members', memberToDelete));
      setStatusMessage({ type: 'success', text: 'Member deleted successfully' });
      setIsConfirmDeleteOpen(false);
      setMemberToDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `members/${memberToDelete}`);
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const targetIds = selectedMemberIds;
    if (targetIds.length === 0) {
      setStatusMessage({ type: 'error', text: 'Please select at least one member' });
      return;
    }

    const now = new Date();
    const month = depositMonth;

    try {
      for (const memberId of targetIds) {
        const member = members.find(m => m.id === memberId);
        if (!member) continue;

        const monthTransactions = transactions.filter(t => t.memberId === memberId && t.month === month);
        const alreadyPaid = monthTransactions.reduce((sum, t) => sum + t.amount, 0);

        if (depositView === 'pending') {
          let amountToDeposit: number;
          if (targetIds.length > 1) {
            amountToDeposit = Number(member.monthlyContribution) - alreadyPaid;
          } else {
            amountToDeposit = Number(depositAmount);
            if (isNaN(amountToDeposit) || amountToDeposit <= 0) {
              setStatusMessage({ type: 'error', text: 'Please enter a valid amount' });
              return;
            }
            if (alreadyPaid + amountToDeposit > member.monthlyContribution) {
              setStatusMessage({ type: 'error', text: `Total deposit for ${member.name} cannot exceed ${member.monthlyContribution}` });
              return;
            }
          }

          if (amountToDeposit > 0) {
            // 1. Add Transaction
            await addDoc(collection(db, 'transactions'), {
              memberId: memberId,
              amount: amountToDeposit,
              date: now.toISOString(),
              month,
              createdAt: serverTimestamp()
            }).catch(err => handleFirestoreError(err, OperationType.CREATE, 'transactions'));

            // 2. Update Member
            await updateDoc(doc(db, 'members', memberId), {
              totalDeposited: (Number(member.totalDeposited) || 0) + amountToDeposit,
              lastPaymentDate: now.toISOString()
            }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `members/${memberId}`));
          }
        } else {
          // Completed View (Update case)
          const newTotal = Number(depositAmount);
          if (isNaN(newTotal) || newTotal < 0) {
            setStatusMessage({ type: 'error', text: 'Please enter a valid amount' });
            return;
          }
          if (newTotal > member.monthlyContribution) {
            setStatusMessage({ type: 'error', text: `Total deposit for ${member.name} cannot exceed ${member.monthlyContribution}` });
            return;
          }

          const diff = newTotal - alreadyPaid;
          if (diff === 0) continue;

          // Consolidate transactions for this month into one
          for (const t of monthTransactions) {
            await deleteDoc(doc(db, 'transactions', t.id)).catch(err => handleFirestoreError(err, OperationType.DELETE, `transactions/${t.id}`));
          }

          if (newTotal > 0) {
            await addDoc(collection(db, 'transactions'), {
              memberId: memberId,
              amount: newTotal,
              date: now.toISOString(),
              month,
              createdAt: serverTimestamp()
            }).catch(err => handleFirestoreError(err, OperationType.CREATE, 'transactions'));
          }

          // Update Member
          await updateDoc(doc(db, 'members', memberId), {
            totalDeposited: (Number(member.totalDeposited) || 0) + diff,
            lastPaymentDate: now.toISOString()
          }).catch(err => handleFirestoreError(err, OperationType.UPDATE, `members/${memberId}`));
        }
      }

      setStatusMessage({ type: 'success', text: depositView === 'pending' ? `${targetIds.length} deposit(s) confirmed successfully` : 'Deposit updated successfully' });
      setIsDepositModalOpen(false);
      setDepositAmount('');
      setSelectedMemberIds([]);
    } catch (err) {
      console.error(err);
      setStatusMessage({ type: 'error', text: err instanceof Error ? err.message : 'Error processing deposit' });
    }
  };

  const handleUpdateSettings = async () => {
    try {
      const settingsColl = collection(db, 'settings');
      const data = {
        interestRate: Number(settingsForm.interestRate),
        duration: Number(settingsForm.duration),
        announcement: settingsForm.announcement,
        showAnnouncement: settingsForm.showAnnouncement,
        announcementSpeed: Number(settingsForm.announcementSpeed),
        tagline1: settingsForm.tagline1,
        tagline2: settingsForm.tagline2,
        heroTitle: settingsForm.heroTitle,
        heroSubtitle: settingsForm.heroSubtitle,
        showContactPersons: settingsForm.showContactPersons,
        contactPerson1: settingsForm.contactPerson1,
        contactPerson2: settingsForm.contactPerson2,
        updatedAt: new Date().toISOString()
      };

      if (settings && (settings as any).id) {
        await updateDoc(doc(db, 'settings', (settings as any).id), {
          ...data,
          startDate: settingsForm.startDate
        });
      } else {
        // Find existing settings doc if any
        const q = query(settingsColl, limit(1));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          await addDoc(settingsColl, {
            ...data,
            startDate: settingsForm.startDate
          });
        } else {
          await updateDoc(doc(db, 'settings', snapshot.docs[0].id), {
            ...data,
            startDate: settingsForm.startDate
          });
        }
      }
      
      setStatusMessage({ type: 'success', text: 'Settings updated successfully' });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings');
    }
  };

  const exportToCSV = () => {
    const headers = ['Name', 'ID', 'Monthly Contribution', 'Total Deposited', 'Status'];
    const rows = members.map(m => [m.name, m.memberId, m.monthlyContribution, m.totalDeposited, m.status]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "members_data.csv";
    link.click();
  };

  const chartData = chartMonths.map(month => ({
    month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    amount: transactions
      .filter(t => t.month === month && members.some(m => m.id === t.memberId))
      .reduce((sum, t) => sum + t.amount, 0)
  }));

  const totalDeposited = members.reduce((sum, m) => sum + m.totalDeposited, 0);
  
  // Calculate total interest by summing individual member interests
  const memberCalculations = members.map(m => calculateInterest(
    m.totalDeposited,
    settings.interestRate,
    settings.duration
  ));
  
  const totalInterest = memberCalculations.reduce((sum, c) => sum + c.interestEarned, 0);
  const totalFinal = totalDeposited + totalInterest;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500">Manage members, deposits, and system settings.</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100">
              <Calendar className="w-4 h-4 text-indigo-600 mr-2" />
              <div>
                <p className="text-[10px] uppercase font-bold text-indigo-400 leading-none">Group Started</p>
                <p className="text-sm font-bold text-indigo-700">{new Date(settings.startDate + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
              </div>
            </div>
            <div className="flex items-center bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm">
              <Clock className="w-4 h-4 text-indigo-600 mr-2" />
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-400 leading-none">Current Time</p>
                <p className="text-sm font-bold text-gray-700">
                  {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} • {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => { setEditingMember(null); setMemberForm({ name: '', memberId: '', phone: '', monthlyContribution: '', status: 'Active' }); setIsMemberModalOpen(true); }}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Member
            </button>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => { 
                  setDepositView('pending'); 
                  setSelectedMemberIds([]);
                  setDepositAmount('');
                  setIsDepositModalOpen(true); 
                }}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all shadow-sm"
              >
                <span className="w-4 h-4 mr-2 flex items-center justify-center font-bold">৳</span> New Deposit
              </button>
              <button 
                onClick={() => { 
                  setDepositView('completed'); 
                  setSelectedMemberIds([]);
                  setDepositAmount('');
                  setIsDepositModalOpen(true); 
                }}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-sm"
              >
                <CheckCircle className="w-4 h-4 mr-2" /> Done Deposit
              </button>
            </div>
            <button 
              onClick={exportToCSV}
              className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all"
            >
              <Download className="w-4 h-4 mr-2" /> Export
            </button>
          </div>
        </div>
      </div>

      {/* Settings Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-8 overflow-hidden">
        {/* Global Interest Settings Header */}
        <div 
          className="p-6 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => toggleSection('interest')}
        >
          <div className="flex items-center">
            <SettingsIcon className="w-5 h-5 text-indigo-500 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Global Interest Settings</h2>
          </div>
          {expandedSections.interest ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </div>

        <AnimatePresence>
          {expandedSections.interest && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="px-6 pb-6"
            >
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Interest Rate (%)</label>
                  <input 
                    type="number" 
                    value={settingsForm.interestRate} 
                    onChange={(e) => setSettingsForm({...settingsForm, interestRate: Number(e.target.value)})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Duration (Months)</label>
                  <input 
                    type="number" 
                    value={settingsForm.duration} 
                    onChange={(e) => setSettingsForm({...settingsForm, duration: Number(e.target.value)})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Start Month</label>
                  <input 
                    type="month" 
                    value={settingsForm.startDate} 
                    onChange={(e) => setSettingsForm({...settingsForm, startDate: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <button 
                  onClick={handleUpdateSettings}
                  className="inline-flex items-center justify-center px-4 py-2 bg-indigo-50 text-indigo-600 font-semibold rounded-xl hover:bg-indigo-100 transition-all"
                >
                  <Save className="w-4 h-4 mr-2" /> Save Settings
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Announcement Bar Section */}
        <div className="border-t border-gray-100">
          <div 
            className="p-6 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection('announcement')}
          >
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-amber-500 mr-2" />
              <h3 className="text-md font-semibold text-gray-900">Announcement Bar</h3>
            </div>
            <div className="flex items-center gap-4">
              <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={settingsForm.showAnnouncement}
                  onChange={(e) => setSettingsForm({...settingsForm, showAnnouncement: e.target.checked})}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
              {expandedSections.announcement ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </div>
          </div>

          <AnimatePresence>
            {expandedSections.announcement && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="px-6 pb-6"
              >
                <div className="flex gap-4">
                  <div className="flex-grow">
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Announcement Text</label>
                    <textarea 
                      value={settingsForm.announcement} 
                      onChange={(e) => setSettingsForm({...settingsForm, announcement: e.target.value})}
                      placeholder="Enter announcement text here..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500 min-h-[80px]"
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Speed (Sec)</label>
                    <input 
                      type="number" 
                      min="5"
                      max="200"
                      value={settingsForm.announcementSpeed} 
                      onChange={(e) => setSettingsForm({...settingsForm, announcementSpeed: Number(e.target.value)})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Higher = Slower</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Branding & Taglines Section */}
        <div className="border-t border-gray-100">
          <div 
            className="p-6 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection('branding')}
          >
            <div className="flex items-center">
              <PiggyBank className="w-5 h-5 text-indigo-500 mr-2" />
              <h3 className="text-md font-semibold text-gray-900">Branding & Taglines</h3>
            </div>
            {expandedSections.branding ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </div>

          <AnimatePresence>
            {expandedSections.branding && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="px-6 pb-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Primary Tagline (Main Title)</label>
                    <input 
                      type="text" 
                      value={settingsForm.tagline1} 
                      onChange={(e) => setSettingsForm({...settingsForm, tagline1: e.target.value})}
                      placeholder="e.g., Samriddhi Welfare Association"
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Secondary Tagline (Subtitle)</label>
                    <input 
                      type="text" 
                      value={settingsForm.tagline2} 
                      onChange={(e) => setSettingsForm({...settingsForm, tagline2: e.target.value})}
                      placeholder="e.g., Collective savings, strong future"
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Public Page Title</label>
                    <input 
                      type="text" 
                      value={settingsForm.heroTitle} 
                      onChange={(e) => setSettingsForm({...settingsForm, heroTitle: e.target.value})}
                      placeholder="e.g., Savings Group Overview"
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Public Page Subtitle</label>
                    <input 
                      type="text" 
                      value={settingsForm.heroSubtitle} 
                      onChange={(e) => setSettingsForm({...settingsForm, heroSubtitle: e.target.value})}
                      placeholder="e.g., Transparent tracking of our collective growth."
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Contact Persons Section */}
        <div className="border-t border-gray-100">
          <div 
            className="p-6 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleSection('contact')}
          >
            <div className="flex items-center">
              <Users className="w-5 h-5 text-indigo-500 mr-2" />
              <h3 className="text-md font-semibold text-gray-900">Contact Persons (Public Page Bottom)</h3>
            </div>
            <div className="flex items-center gap-4">
              <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={settingsForm.showContactPersons}
                  onChange={(e) => setSettingsForm({...settingsForm, showContactPersons: e.target.checked})}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
              {expandedSections.contact ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
            </div>
          </div>

          <AnimatePresence>
            {expandedSections.contact && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="px-6 pb-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Contact Person 1 */}
                  <div className="space-y-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider">Left Card (Person 1)</h4>
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Name</label>
                        <input 
                          type="text" 
                          value={settingsForm.contactPerson1.name} 
                          onChange={(e) => setSettingsForm({...settingsForm, contactPerson1: {...settingsForm.contactPerson1, name: e.target.value}})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Role</label>
                        <input 
                          type="text" 
                          value={settingsForm.contactPerson1.role} 
                          onChange={(e) => setSettingsForm({...settingsForm, contactPerson1: {...settingsForm.contactPerson1, role: e.target.value}})}
                          placeholder="e.g., Manager"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Phone</label>
                          <input 
                            type="text" 
                            value={settingsForm.contactPerson1.phone} 
                            onChange={(e) => setSettingsForm({...settingsForm, contactPerson1: {...settingsForm.contactPerson1, phone: e.target.value}})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Email</label>
                          <input 
                            type="email" 
                            value={settingsForm.contactPerson1.email} 
                            onChange={(e) => setSettingsForm({...settingsForm, contactPerson1: {...settingsForm.contactPerson1, email: e.target.value}})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Image URL or Upload</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={settingsForm.contactPerson1.imageUrl} 
                            onChange={(e) => setSettingsForm({...settingsForm, contactPerson1: {...settingsForm.contactPerson1, imageUrl: e.target.value}})}
                            placeholder="https://..."
                            className="flex-grow px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                          <label className="cursor-pointer bg-white border border-gray-300 px-3 py-2 rounded-lg text-xs font-bold hover:bg-gray-50 flex items-center">
                            Upload
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setSettingsForm({...settingsForm, contactPerson1: {...settingsForm.contactPerson1, imageUrl: reader.result as string}});
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                        </div>
                        {settingsForm.contactPerson1.imageUrl && (
                          <div className="mt-2 w-12 h-12 rounded-full overflow-hidden border border-gray-200">
                            <img src={settingsForm.contactPerson1.imageUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contact Person 2 */}
                  <div className="space-y-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <h4 className="text-sm font-bold text-indigo-600 uppercase tracking-wider">Right Card (Person 2)</h4>
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Name</label>
                        <input 
                          type="text" 
                          value={settingsForm.contactPerson2.name} 
                          onChange={(e) => setSettingsForm({...settingsForm, contactPerson2: {...settingsForm.contactPerson2, name: e.target.value}})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Role</label>
                        <input 
                          type="text" 
                          value={settingsForm.contactPerson2.role} 
                          onChange={(e) => setSettingsForm({...settingsForm, contactPerson2: {...settingsForm.contactPerson2, role: e.target.value}})}
                          placeholder="e.g., Assistant Manager"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Phone</label>
                          <input 
                            type="text" 
                            value={settingsForm.contactPerson2.phone} 
                            onChange={(e) => setSettingsForm({...settingsForm, contactPerson2: {...settingsForm.contactPerson2, phone: e.target.value}})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Email</label>
                          <input 
                            type="email" 
                            value={settingsForm.contactPerson2.email} 
                            onChange={(e) => setSettingsForm({...settingsForm, contactPerson2: {...settingsForm.contactPerson2, email: e.target.value}})}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Image URL or Upload</label>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={settingsForm.contactPerson2.imageUrl} 
                            onChange={(e) => setSettingsForm({...settingsForm, contactPerson2: {...settingsForm.contactPerson2, imageUrl: e.target.value}})}
                            placeholder="https://..."
                            className="flex-grow px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                          <label className="cursor-pointer bg-white border border-gray-300 px-3 py-2 rounded-lg text-xs font-bold hover:bg-gray-50 flex items-center">
                            Upload
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setSettingsForm({...settingsForm, contactPerson2: {...settingsForm.contactPerson2, imageUrl: reader.result as string}});
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                        </div>
                        {settingsForm.contactPerson2.imageUrl && (
                          <div className="mt-2 w-12 h-12 rounded-full overflow-hidden border border-gray-200">
                            <img src={settingsForm.contactPerson2.imageUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="px-6 pb-6 pt-2 flex justify-end">
            <button 
              onClick={handleUpdateSettings}
              className="inline-flex items-center justify-center px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              <Save className="w-5 h-5 mr-2" /> Save All Settings
            </button>
          </div>
        </div>
      </div>

      {/* Stats and Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
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
        
        <div className="space-y-4">
          <div className="bg-indigo-600 p-6 rounded-2xl text-white shadow-lg shadow-indigo-200">
            <p className="text-indigo-100 text-sm font-medium">Total Final Balance</p>
            <h4 className="text-3xl font-bold mt-1">{formatCurrency(totalFinal)}</h4>
            <div className="mt-4 pt-4 border-t border-indigo-500 flex justify-between items-center text-sm">
              <span>Interest Earned</span>
              <span className="font-bold">+{formatCurrency(totalInterest)}</span>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-gray-500 text-sm font-medium">Active Members</p>
            <h4 className="text-3xl font-bold mt-1 text-gray-900">{members.filter(m => m.status === 'Active').length} / {members.length}</h4>
          </div>
        </div>
      </div>

      {/* 3-Column Status Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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

      {/* Members Table */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">Member Management</h3>
        </div>
        <div className="overflow-x-auto">
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Monthly</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Months Paid</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <SortableContext 
                  items={members.map(m => m.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {members.map((member) => (
                    <SortableMemberRow 
                      key={member.id} 
                      member={member} 
                      transactions={transactions}
                      expectedMonths={expectedMonths}
                      onEdit={(m) => {
                        setEditingMember(m);
                        setMemberForm({
                          name: m.name,
                          memberId: m.memberId,
                          phone: m.phone || '',
                          monthlyContribution: String(m.monthlyContribution),
                          status: m.status
                        });
                        setIsMemberModalOpen(true);
                      }}
                      onDelete={(id) => {
                        setMemberToDelete(id);
                        setIsConfirmDeleteOpen(true);
                      }}
                    />
                  ))}
                </SortableContext>
              </tbody>
            </table>
          </DndContext>
        </div>
      </div>

      {/* Member Modal */}
      <AnimatePresence>
        {isMemberModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">{editingMember ? 'Edit Member' : 'Add New Member'}</h3>
                <button onClick={() => setIsMemberModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleSaveMember} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input 
                    required 
                    type="text" 
                    value={memberForm.name} 
                    onChange={(e) => setMemberForm({...memberForm, name: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unique ID</label>
                  <input 
                    required 
                    type="text" 
                    value={memberForm.memberId} 
                    onChange={(e) => setMemberForm({...memberForm, memberId: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <input 
                    type="tel" 
                    value={memberForm.phone} 
                    onChange={(e) => setMemberForm({...memberForm, phone: e.target.value})}
                    placeholder="e.g., +8801700000000"
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Contribution</label>
                  <input 
                    required 
                    type="number" 
                    value={memberForm.monthlyContribution} 
                    onChange={(e) => setMemberForm({...memberForm, monthlyContribution: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select 
                    value={memberForm.status} 
                    onChange={(e) => setMemberForm({...memberForm, status: e.target.value as 'Active' | 'Inactive'})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsMemberModalOpen(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50">Cancel</button>
                  <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold">Save Member</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Deposit Modal */}
      <AnimatePresence>
        {isDepositModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">
                  {depositView === 'pending' ? 'Log New Deposits' : 'View Completed Deposits'}
                </h3>
                <button onClick={() => { setIsDepositModalOpen(false); setSelectedMemberIds([]); }} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
              </div>
              <form onSubmit={handleDeposit} className="p-6 space-y-4">
                <div className="flex gap-4">
                  <div className="flex-grow">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Select Month</label>
                    <input 
                      type="month" 
                      value={depositMonth} 
                      onChange={(e) => {
                        setDepositMonth(e.target.value);
                        setSelectedMemberIds([]);
                        setDepositAmount('');
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div className="w-1/2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {depositView === 'pending' 
                        ? (selectedMemberIds.length > 1 ? 'Bulk Deposit Info' : 'Deposit Amount (৳)') 
                        : 'Updated Total Amount (৳)'}
                    </label>
                    {depositView === 'pending' && selectedMemberIds.length > 1 ? (
                      <div className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-medium border border-indigo-100 h-[42px] flex items-center">
                        Remaining monthly contribution applied to each
                      </div>
                    ) : (
                      <input 
                        required 
                        type="number" 
                        value={depositAmount} 
                        onChange={(e) => setDepositAmount(e.target.value)}
                        max={(() => {
                          if (selectedMemberIds.length === 1) {
                            const member = members.find(m => m.id === selectedMemberIds[0]);
                            if (member) {
                              if (depositView === 'pending') {
                                const monthTransactions = transactions.filter(t => t.memberId === member.id && t.month === depositMonth);
                                const alreadyPaid = monthTransactions.reduce((sum, t) => sum + t.amount, 0);
                                return member.monthlyContribution - alreadyPaid;
                              } else {
                                return member.monthlyContribution;
                              }
                            }
                          }
                          return undefined;
                        })()}
                        min="0"
                        placeholder="e.g., 1000"
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500" 
                      />
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {depositView === 'pending' ? 'Select Members (Pending)' : 'Members (Completed)'}
                    </label>
                    {depositView === 'pending' && (
                      <button 
                        type="button"
                        onClick={() => {
                          const pendingMembers = members.filter(m => {
                            const monthTransactions = transactions.filter(t => t.memberId === m.id && t.month === depositMonth);
                            const paidThisMonth = monthTransactions.reduce((sum, t) => sum + t.amount, 0);
                            return paidThisMonth < m.monthlyContribution && m.status === 'Active';
                          });
                          if (selectedMemberIds.length === pendingMembers.length) {
                            setSelectedMemberIds([]);
                          } else {
                            setSelectedMemberIds(pendingMembers.map(m => m.id));
                          }
                        }}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                      >
                        {(() => {
                          const pendingMembers = members.filter(m => {
                            const monthTransactions = transactions.filter(t => t.memberId === m.id && t.month === depositMonth);
                            const paidThisMonth = monthTransactions.reduce((sum, t) => sum + t.amount, 0);
                            return paidThisMonth < m.monthlyContribution && m.status === 'Active';
                          });
                          return selectedMemberIds.length === pendingMembers.length ? 'Deselect All' : 'Select All';
                        })()}
                      </button>
                    )}
                  </div>
                  
                  <div className="border border-gray-200 rounded-xl max-h-[250px] overflow-y-auto p-2 space-y-1">
                    {(() => {
                      const filteredMembers = members.filter(m => {
                        const monthTransactions = transactions.filter(t => t.memberId === m.id && t.month === depositMonth);
                        const paidThisMonth = monthTransactions.reduce((sum, t) => sum + t.amount, 0);
                        return depositView === 'pending' ? paidThisMonth < m.monthlyContribution : paidThisMonth >= m.monthlyContribution;
                      });

                      if (filteredMembers.length === 0) {
                        return (
                          <div className="text-center py-8 text-gray-400 text-sm italic">
                            {depositView === 'pending' ? 'All members have paid for this month!' : 'No deposits logged for this month yet.'}
                          </div>
                        );
                      }

                      return filteredMembers.map(member => {
                        const monthTransactions = transactions.filter(t => t.memberId === member.id && t.month === depositMonth);
                        const paidThisMonth = monthTransactions.reduce((sum, t) => sum + t.amount, 0);
                        
                        return (
                          <label 
                            key={member.id} 
                            className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                              selectedMemberIds.includes(member.id) ? 'bg-indigo-50 border-indigo-100' : 'hover:bg-gray-50 border-transparent'
                            } border`}
                          >
                            <div className="flex items-center gap-3">
                              <input 
                                type={depositView === 'pending' ? "checkbox" : "radio"}
                                name="member-selection"
                                checked={selectedMemberIds.includes(member.id)}
                                onChange={(e) => {
                                  let newSelected;
                                  if (depositView === 'pending') {
                                    if (e.target.checked) {
                                      newSelected = [...selectedMemberIds, member.id];
                                    } else {
                                      newSelected = selectedMemberIds.filter(id => id !== member.id);
                                    }
                                  } else {
                                    newSelected = [member.id];
                                  }
                                  setSelectedMemberIds(newSelected);
                                  
                                  // If only one member is selected, default the amount
                                  if (newSelected.length === 1) {
                                    const selectedMember = members.find(m => m.id === newSelected[0]);
                                    if (selectedMember) {
                                      if (depositView === 'pending') {
                                        const mTransactions = transactions.filter(t => t.memberId === selectedMember.id && t.month === depositMonth);
                                        const alreadyPaid = mTransactions.reduce((sum, t) => sum + t.amount, 0);
                                        setDepositAmount(String(selectedMember.monthlyContribution - alreadyPaid));
                                      } else {
                                        const mTransactions = transactions.filter(t => t.memberId === selectedMember.id && t.month === depositMonth);
                                        const alreadyPaid = mTransactions.reduce((sum, t) => sum + t.amount, 0);
                                        setDepositAmount(String(alreadyPaid));
                                      }
                                    }
                                  }
                                }}
                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                              />
                              <div>
                                <p className="text-sm font-bold text-gray-900 leading-none">{member.name}</p>
                                <p className="text-[10px] text-gray-400 font-mono mt-1">{member.memberId}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-gray-900 leading-none">
                                {formatCurrency(paidThisMonth)} / {formatCurrency(member.monthlyContribution)}
                              </p>
                              <p className="text-[10px] text-gray-400 mt-1">
                                {depositView === 'pending' ? 'Paid so far' : 'Total Paid'}
                              </p>
                            </div>
                          </label>
                        );
                      });
                    })()}
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => { setIsDepositModalOpen(false); setSelectedMemberIds([]); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50">Cancel</button>
                  {depositView === 'pending' && (
                    <button 
                      type="submit" 
                      disabled={selectedMemberIds.length === 0}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Confirm {selectedMemberIds.length} Deposit(s)
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {isConfirmDeleteOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden p-6"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Confirm Delete</h3>
                <p className="text-gray-500 mb-6">Are you sure you want to delete this member? This action cannot be undone.</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsConfirmDeleteOpen(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDeleteMember}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Status Messages */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 right-8 px-6 py-3 rounded-2xl shadow-lg z-50 flex items-center space-x-2 ${
              statusMessage.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {statusMessage.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            <span className="font-medium">{statusMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

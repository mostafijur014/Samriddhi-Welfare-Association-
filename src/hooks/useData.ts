import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

export interface ContributionHistory {
  amount: number;
  startMonth: string; // YYYY-MM
}

export interface Member {
  id: string;
  name: string;
  memberId: string;
  phone?: string;
  monthlyContribution: number;
  yearlyFixedDeposit: number;
  monthlyContributionHistory?: ContributionHistory[];
  yearlyDepositHistory?: ContributionHistory[];
  totalDeposited: number;
  totalYearlyPaid: number;
  lastPaymentDate: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
  order: number;
}

export interface Transaction {
  id: string;
  memberId: string;
  amount: number;
  date: string;
  month: string;
  type: 'monthly' | 'yearly';
}

export interface ContactPerson {
  name: string;
  role: string;
  phone: string;
  email: string;
  imageUrl: string;
}

export interface Settings {
  interestRate: number;
  duration: number;
  startDate: string;
  announcement?: string;
  showAnnouncement?: boolean;
  announcementSpeed?: number;
  tagline1?: string;
  tagline2?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  dueStartDate?: number;
  dueEndDate?: number;
  showContactPersons?: boolean;
  contactPerson1?: ContactPerson;
  contactPerson2?: ContactPerson;
}

export const useData = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<Settings>({ 
    interestRate: 5, 
    duration: 12,
    startDate: new Date().toISOString().slice(0, 7), // Default to current month
    announcementSpeed: 40, // Default speed
    tagline1: 'Samriddhi Welfare Association',
    tagline2: 'Collective savings, strong future',
    heroTitle: 'Savings Group Overview',
    heroSubtitle: 'Transparent tracking of our collective growth.',
    dueStartDate: 15,
    dueEndDate: 20
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let membersLoaded = false;
    let transactionsLoaded = false;
    let settingsLoaded = false;

    const checkLoading = () => {
      if (membersLoaded && transactionsLoaded && settingsLoaded) {
        setLoading(false);
      }
    };

    const qMembers = query(collection(db, 'members'), orderBy('order', 'asc'));
    const unsubMembers = onSnapshot(qMembers, (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Member)));
      membersLoaded = true;
      checkLoading();
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'members');
      setError(err.message);
      setLoading(false);
    });

    const qTransactions = query(collection(db, 'transactions'), orderBy('date', 'desc'));
    const unsubTransactions = onSnapshot(qTransactions, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      transactionsLoaded = true;
      checkLoading();
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'transactions');
      setError(err.message);
      setLoading(false);
    });

    const unsubSettings = onSnapshot(collection(db, 'settings'), (snapshot) => {
      if (!snapshot.empty) {
        setSettings(snapshot.docs[0].data() as Settings);
      }
      settingsLoaded = true;
      checkLoading();
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'settings');
      setError(err.message);
      setLoading(false);
    });

    return () => {
      unsubMembers();
      unsubTransactions();
      unsubSettings();
    };
  }, []);

  return { members, transactions, settings, loading, error };
};

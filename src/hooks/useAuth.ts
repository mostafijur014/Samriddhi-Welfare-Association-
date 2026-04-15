import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, User } from 'firebase/auth';
import { auth } from '../firebase';

// We use a virtual email domain to allow "username" style login with Firebase Auth
const VIRTUAL_DOMAIN = 'prosperity.local';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (username: string, pass: string) => {
    try {
      // Map username to virtual email if it doesn't look like an email
      const email = username.includes('@') ? username : `${username}@${VIRTUAL_DOMAIN}`;
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const isAdmin = !!user;

  return { 
    user, 
    loading, 
    isAdmin, 
    login, 
    logout 
  };
};

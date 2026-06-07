import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useTheme(userId?: string) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    if (!userId) return;

    const fetchTheme = async () => {
      const snap = await getDoc(doc(db, 'users', userId));
      if (snap.exists() && snap.data()?.theme) {
        setTheme(snap.data().theme as 'light' | 'dark');
      }
    };

    fetchTheme();
  }, [userId]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);

    if (userId) {
      await updateDoc(doc(db, 'users', userId), { theme: newTheme });
    }
  };

  return { theme, toggleTheme };
}

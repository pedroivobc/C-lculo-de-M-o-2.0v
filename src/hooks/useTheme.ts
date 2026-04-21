import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useTheme(userId?: string) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    if (!userId) return;

    const fetchTheme = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('theme')
        .eq('id', userId)
        .single();

      if (data?.theme) {
        setTheme(data.theme as 'light' | 'dark');
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
      await supabase
        .from('profiles')
        .update({ theme: newTheme })
        .eq('id', userId);
    }
  };

  return { theme, toggleTheme };
}

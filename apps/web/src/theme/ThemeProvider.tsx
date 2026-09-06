import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_THEME, isThemeId, type ThemeId } from './themes';

type ThemeContextValue = {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  reload: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'his.theme';

function applyTheme(theme: ThemeId) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isThemeId(stored) ? stored : DEFAULT_THEME;
  });

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const reload = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/appearance', { credentials: 'include' });
      if (!response.ok) return;
      const raw = await response.text();
      if (!raw) return;
      const data = JSON.parse(raw);
      if (isThemeId(data.theme)) setThemeState(data.theme);
    } catch {
      /* keep local theme */
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next);
    applyTheme(next);
  }, []);

  const value = useMemo(
    () => ({ theme, setTheme, reload }),
    [theme, setTheme, reload],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

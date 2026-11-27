import { DEFAULT_SETTINGS, THEMES, type Theme } from '../types';

// The theme's source of truth is the settings in IndexedDB. This localStorage copy
// only lets the very first paint use the right colors before the database has loaded.
const KEY = 'expensiveme.theme';

const BG = { light: '#f7f1e6', dark: '#221d19' };
const darkQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)');

export function cachedTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY) as Theme | null;
    return t && THEMES.includes(t) ? t : DEFAULT_SETTINGS.theme;
  } catch {
    return DEFAULT_SETTINGS.theme;
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark' || (theme === 'system' && !!darkQuery()?.matches);
  // status bar / browser chrome color
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? BG.dark : BG.light);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* storage unavailable: theme still applies, just not before the DB loads */
  }
}

/** Re-apply when the device switches light/dark while "System" is selected. */
export function watchSystemTheme(theme: Theme): () => void {
  const q = darkQuery();
  if (theme !== 'system' || !q) return () => {};
  const onChange = () => applyTheme('system');
  q.addEventListener('change', onChange);
  return () => q.removeEventListener('change', onChange);
}

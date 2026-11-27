import { useCallback, useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { AddSheet, type Draft } from './components/AddSheet';
import { CalculatorSheet } from './components/CalculatorSheet';
import { Dashboard } from './components/Dashboard';
import { IncomeSheet } from './components/IncomeSheet';
import { IncomeTab } from './components/IncomeTab';
import { Settings } from './components/Settings';
import { ToastHost } from './components/Toast';
import { TxnList, type ListFilter } from './components/TxnList';
import { useThemeSetting } from './db';
import { periodAround, today, type Period } from './lib/dates';
import { applyTheme, watchSystemTheme } from './lib/theme';
import type { Income, Txn } from './types';

type Tab = 'home' | 'list' | 'income' | 'settings';
const TABS: Tab[] = ['home', 'list', 'income', 'settings'];

function readTab(): Tab {
  const t = window.location.hash.replace(/^#\/?/, '') as Tab;
  return TABS.includes(t) ? t : 'home';
}

export default function App() {
  const [tab, setTab] = useState<Tab>(readTab);
  const [period, setPeriod] = useState<Period>(() => periodAround('month', today()));
  const [filter, setFilter] = useState<ListFilter>({ who: 'all', tag: null, q: '' });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [calcOpen, setCalcOpen] = useState(false);
  const [incomePeriod, setIncomePeriod] = useState<Period>(() => periodAround('month', today()));
  /** null = closed, {} = new entry, {income} = editing */
  const [incomeDraft, setIncomeDraft] = useState<{ income?: Income } | null>(null);
  const theme = useThemeSetting();

  useEffect(() => {
    if (!theme) return; // still loading: keep the cached theme main.tsx applied
    applyTheme(theme);
    return watchSystemTheme(theme);
  }, [theme]);

  useEffect(() => {
    const onHash = () => setTab(readTab());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (t: Tab) => {
    if (t === tab) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    window.location.hash = t === 'home' ? '/' : `/${t}`;
    window.scrollTo({ top: 0 });
  };

  const closeDraft = useCallback(() => setDraft(null), []);
  const closeCalc = useCallback(() => setCalcOpen(false), []);
  const closeIncome = useCallback(() => setIncomeDraft(null), []);
  const duplicate = useCallback((t: Txn) => {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = t;
    // let the sheet close before opening the new one
    setTimeout(() => setDraft({ prefill: { ...rest, date: today() } }), 0);
  }, []);

  const title = { home: 'ExpensiveMe', list: 'Transactions', income: 'Income', settings: 'Settings' }[tab];

  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <header className="pt-safe sticky top-0 z-20 bg-bg/90 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-4">
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          <button
            onClick={() => setCalcOpen(true)}
            aria-label="Open calculator"
            className="grid size-11 place-items-center rounded-full bg-surface text-ink-2 shadow-sm active:scale-95"
          >
            <CalcIcon />
          </button>
        </div>
      </header>

      <main className="px-4 pt-1 pb-[calc(env(safe-area-inset-bottom)+7rem)]">
        {tab === 'home' && (
          <Dashboard
            period={period}
            onPeriod={setPeriod}
            onAdd={() => setDraft({})}
            onOpenTag={(tag) => {
              setFilter({ who: 'all', q: '', tag: tag ?? '__none' });
              go('list');
            }}
          />
        )}
        {tab === 'list' && <TxnList period={period} onPeriod={setPeriod} filter={filter} onFilter={setFilter} onEdit={(t) => setDraft({ txn: t })} />}
        {tab === 'income' && (
          <IncomeTab
            period={incomePeriod}
            onPeriod={setIncomePeriod}
            onAdd={() => setIncomeDraft({})}
            onEdit={(income) => setIncomeDraft({ income })}
          />
        )}
        {tab === 'settings' && <Settings />}
      </main>

      {/* Add button */}
      {tab !== 'settings' && (
        <button
          onClick={() => (tab === 'income' ? setIncomeDraft({}) : setDraft({}))}
          aria-label={tab === 'income' ? 'Add income' : 'Add expense'}
          className="fixed right-[max(1rem,calc(50%-14rem+1rem))] bottom-[calc(env(safe-area-inset-bottom)+4.75rem)] z-30 grid size-14 place-items-center rounded-full bg-accent text-accent-ink shadow-lg active:scale-95"
        >
          <PlusIcon />
        </button>
      )}

      {/* Tab bar */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur" aria-label="Main">
        <div className="mx-auto grid h-16 max-w-md grid-cols-4">
          <TabBtn active={tab === 'home'} onClick={() => go('home')} label="Home" icon={<HomeIcon />} />
          <TabBtn active={tab === 'list'} onClick={() => go('list')} label="Transactions" icon={<ListIcon />} />
          <TabBtn active={tab === 'income'} onClick={() => go('income')} label="Income" icon={<WalletIcon />} />
          <TabBtn active={tab === 'settings'} onClick={() => go('settings')} label="Settings" icon={<GearIcon />} />
        </div>
      </nav>

      {draft && <AddSheet key={draft.txn?.id ?? 'new'} draft={draft} onClose={closeDraft} onDuplicate={duplicate} />}
      {incomeDraft && <IncomeSheet key={incomeDraft.income?.id ?? 'new'} income={incomeDraft.income} onClose={closeIncome} />}
      {calcOpen && (
        <CalculatorSheet
          onClose={closeCalc}
          onUseAmount={(amount) => {
            setCalcOpen(false);
            setDraft({ prefill: { baseAmount: amount } });
          }}
        />
      )}
      <ToastHost />
      <UpdateBanner />
    </div>
  );
}

function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="pt-safe fixed inset-x-0 top-0 z-50 flex justify-center px-4">
      <div className="animate-fade mt-2 flex w-full max-w-md items-center gap-3 rounded-2xl bg-ink p-3 text-sm text-bg shadow-lg">
        <span className="flex-1">A new version is ready.</span>
        <button onClick={() => setNeedRefresh(false)} className="min-h-10 px-2 opacity-70">
          Later
        </button>
        <button onClick={() => updateServiceWorker(true)} className="min-h-10 rounded-xl bg-accent px-3 font-semibold text-accent-ink">
          Update
        </button>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-col items-center justify-center gap-0.5 text-[11px] ${active ? 'font-semibold text-accent' : 'text-muted'}`}
    >
      {icon}
      {label}
    </button>
  );
}

const svg = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const HomeIcon = () => (
  <svg {...svg} aria-hidden>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
  </svg>
);
const ListIcon = () => (
  <svg {...svg} aria-hidden>
    <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </svg>
);
const WalletIcon = () => (
  <svg {...svg} aria-hidden>
    <rect x="3" y="6" width="18" height="14" rx="2.5" />
    <path d="M6.5 6 15 3.2a1 1 0 0 1 1.3.9V6M16.5 13h.01" />
  </svg>
);
const GearIcon = () => (
  <svg {...svg} aria-hidden>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </svg>
);
const CalcIcon = () => (
  <svg {...svg} aria-hidden>
    <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
    <path d="M8.5 6.5h7M8.5 11h.01M12 11h.01M15.5 11h.01M8.5 14.5h.01M12 14.5h.01M15.5 14.5v3.5M8.5 18h.01M12 18h.01" />
  </svg>
);
const PlusIcon = () => (
  <svg {...svg} width={26} height={26} strokeWidth={2.5} aria-hidden>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

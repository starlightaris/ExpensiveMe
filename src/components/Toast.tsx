import { useEffect, useState } from 'react';

interface ToastMsg {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

type Listener = (t: ToastMsg) => void;
const listeners = new Set<Listener>();
let nextId = 1;

export function toast(text: string, action?: ToastMsg['action']) {
  const msg = { id: nextId++, text, action };
  listeners.forEach((l) => l(msg));
}

export function ToastHost() {
  const [msg, setMsg] = useState<ToastMsg | null>(null);

  useEffect(() => {
    const l: Listener = (t) => setMsg(t);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  useEffect(() => {
    if (!msg) return;
    const timer = setTimeout(() => setMsg(null), msg.action ? 6000 : 2200);
    return () => clearTimeout(timer);
  }, [msg]);

  if (!msg) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-50 flex justify-center px-4">
      <div
        role="status"
        className="animate-fade pointer-events-auto flex min-h-11 items-center gap-4 rounded-full bg-ink px-4 text-sm text-bg shadow-lg"
      >
        <span>{msg.text}</span>
        {msg.action && (
          <button
            className="min-h-11 font-semibold text-[var(--mine)] brightness-125"
            onClick={() => {
              msg.action!.run();
              setMsg(null);
            }}
          >
            {msg.action.label}
          </button>
        )}
      </div>
    </div>
  );
}

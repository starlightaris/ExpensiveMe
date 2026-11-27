import { useEffect, type ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  /** Right side of the header, e.g. a Save button */
  action?: ReactNode;
  /** Pinned above the scrolling body, e.g. the amount display */
  top?: ReactNode;
  /** Pinned below the scrolling body, e.g. a keypad */
  footer?: ReactNode;
  children: ReactNode;
}

/** Bottom sheet on phones, centred dialog on wider screens. */
export function Sheet({ title, onClose, action, top, footer, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="animate-fade absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="animate-sheet relative flex max-h-[94dvh] w-full max-w-md flex-col rounded-t-3xl bg-surface shadow-2xl sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-2 pb-1">
          <button onClick={onClose} className="min-h-11 min-w-16 rounded-full px-2 text-left text-ink-2">
            Cancel
          </button>
          <div className="flex flex-col items-center">
            <span className="mb-1 h-1 w-9 rounded-full bg-line sm:hidden" aria-hidden />
            <h2 className="text-base font-semibold">{title}</h2>
          </div>
          <div className="flex min-w-16 justify-end">{action}</div>
        </div>
        {top && <div className="shrink-0 px-4 pb-1">{top}</div>}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
        {footer && <div className="pb-safe shrink-0 border-t border-line bg-surface-2/60">{footer}</div>}
        {!footer && <div className="pb-safe shrink-0" />}
      </div>
    </div>
  );
}

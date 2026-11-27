import { useEffect, useRef, useState, type ReactNode } from 'react';
import { db, deleteTag, eraseAll, exportBackup, importBackup, parseBackup, saveSettings, saveTag, useSettings, useTags } from '../db';
import { uid } from '../lib/format';
import { today } from '../lib/dates';
import type { Tag } from '../types';
import { toast } from './Toast';

export function Settings() {
  const settings = useSettings();
  const tags = useTags();

  return (
    <div className="space-y-6">
      <Group title="General">
        <Field label="Theme">
          <div className="grid grid-cols-3 rounded-xl bg-surface-2 p-1" role="radiogroup" aria-label="Theme">
            {(
              [
                ['light', 'Light'],
                ['dark', 'Dark'],
                ['system', 'Auto'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                role="radio"
                aria-checked={settings.theme === value}
                onClick={() => saveSettings({ theme: value })}
                title={value === 'system' ? 'Follow the phone’s setting' : undefined}
                className={`min-h-9 rounded-lg px-3 text-sm transition ${
                  settings.theme === value ? 'bg-surface font-semibold text-ink shadow-sm' : 'text-ink-2'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Currency symbol" hint="Shown before amounts">
          <BufferedInput
            value={settings.currency}
            maxLength={6}
            onCommit={(v) => saveSettings({ currency: v.trim() })}
            className="w-24 text-right"
          />
        </Field>
        <Field label="Service charge" hint="Optional extra on Food expenses">
          <div className="flex items-center gap-1">
            <BufferedInput
              value={String(settings.serviceRate)}
              inputMode="decimal"
              maxLength={5}
              onCommit={(v) => {
                const n = parseFloat(v);
                if (Number.isFinite(n) && n >= 0 && n <= 100) saveSettings({ serviceRate: n });
                else toast('Enter a number from 0 to 100');
              }}
              className="w-16 text-right"
            />
            <span className="text-ink-2">%</span>
          </div>
        </Field>
      </Group>

      <TagManager tags={tags} />
      <DataSection />
    </div>
  );
}

function TagManager({ tags }: { tags: Tag[] }) {
  const [emoji, setEmoji] = useState('');
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  async function add() {
    const n = name.trim();
    if (!n) return;
    if (tags.some((t) => t.name.toLowerCase() === n.toLowerCase())) {
      toast('That tag already exists');
      return;
    }
    await saveTag({ id: uid(), name: n.slice(0, 40), emoji: emoji.trim().slice(0, 8) || '🏷️', serviceCharge: false, order: tags.length });
    setName('');
    setEmoji('');
  }

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= tags.length) return;
    const a = tags[i];
    const b = tags[j];
    await db.transaction('rw', db.tags, async () => {
      await db.tags.update(a.id, { order: j });
      await db.tags.update(b.id, { order: i });
    });
  }

  async function remove(t: Tag) {
    const used = await db.transactions.where('tagIds').equals(t.id).count();
    const msg = used
      ? `Delete “${t.name}”? ${used} ${used === 1 ? 'record uses' : 'records use'} it; they’ll keep their amounts but lose this tag.`
      : `Delete “${t.name}”?`;
    if (window.confirm(msg)) await deleteTag(t.id);
  }

  return (
    <Group title="Tags">
      {tags.map((t, i) => (
        <div key={t.id} className="flex items-center gap-2 px-3 py-2">
          {editing === t.id ? (
            <TagEditor
              tag={t}
              onDone={async (patch) => {
                if (patch) await saveTag({ ...t, ...patch });
                setEditing(null);
              }}
            />
          ) : (
            <>
              <button className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setEditing(t.id)}>
                <span className="text-lg">{t.emoji}</span>
                <span className="truncate">{t.name}</span>
              </button>
              <div className="flex">
                <IconBtn label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                  ↑
                </IconBtn>
                <IconBtn label="Move down" onClick={() => move(i, 1)} disabled={i === tags.length - 1}>
                  ↓
                </IconBtn>
                <IconBtn label={`Delete ${t.name}`} onClick={() => remove(t)}>
                  ✕
                </IconBtn>
              </div>
            </>
          )}
        </div>
      ))}
      <form
        className="flex items-center gap-2 px-3 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          placeholder="🏷️"
          aria-label="New tag emoji"
          maxLength={8}
          className="min-h-11 w-14 rounded-xl border border-line bg-surface text-center outline-none focus:border-accent"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New tag"
          aria-label="New tag name"
          maxLength={40}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 outline-none focus:border-accent"
        />
        <button type="submit" disabled={!name.trim()} className="min-h-11 rounded-xl bg-accent px-4 font-semibold text-accent-ink disabled:opacity-40">
          Add
        </button>
      </form>
    </Group>
  );
}

function TagEditor({ tag, onDone }: { tag: Tag; onDone: (patch?: Partial<Tag>) => void }) {
  const [emoji, setEmoji] = useState(tag.emoji);
  const [name, setName] = useState(tag.name);
  return (
    <form
      className="flex w-full items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const n = name.trim();
        onDone(n ? { name: n.slice(0, 40), emoji: emoji.trim().slice(0, 8) || tag.emoji } : undefined);
      }}
    >
      <input
        value={emoji}
        onChange={(e) => setEmoji(e.target.value)}
        aria-label="Emoji"
        maxLength={8}
        className="min-h-11 w-14 rounded-xl border border-line bg-surface text-center outline-none focus:border-accent"
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        aria-label="Tag name"
        maxLength={40}
        className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 outline-none focus:border-accent"
      />
      <button type="submit" className="min-h-11 px-2 font-semibold text-accent">
        Done
      </button>
    </form>
  );
}

function DataSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<string>('');
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {});
    navigator.storage
      ?.estimate?.()
      .then((e) => e.usage !== undefined && setUsage(`${(e.usage / 1024).toFixed(0)} KB used`))
      .catch(() => {});
    db.transactions.count().then(setCount);
  }, []);

  async function doExport() {
    const data = await exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expensiveme-backup-${today()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(`Exported ${data.transactions.length} records`);
  }

  async function doImport(file: File) {
    if (file.size > 20 * 1024 * 1024) {
      toast('That file is too large to be a backup');
      return;
    }
    try {
      const backup = parseBackup(JSON.parse(await file.text()));
      const ok = window.confirm(
        `Import ${backup.transactions.length} expenses, ${backup.income.length} income entries and ${backup.tags.length} tags?\n\nRecords already here are kept; matching ones are updated.`,
      );
      if (!ok) return;
      await importBackup(backup);
      setCount(await db.transactions.count());
      toast(`Imported ${backup.transactions.length} records`);
    } catch (e) {
      toast(e instanceof Error && e.message.length < 80 ? e.message : 'Couldn’t read that file');
    }
  }

  async function doErase() {
    if (!window.confirm('Erase ALL records, tags and settings on this device? This cannot be undone.')) return;
    if (!window.confirm('Really erase everything? Export a backup first if you might want it.')) return;
    await eraseAll();
    setCount(0);
    toast('All data erased');
  }

  return (
    <Group title="Your data">
      <div className="flex items-center justify-between px-3 py-3 text-sm">
        <span className="text-ink-2">
          {count ?? '…'} {count === 1 ? 'record' : 'records'}
          {usage && ` · ${usage}`}
        </span>
        <span className={persisted ? 'text-ink-2' : 'text-covered'}>
          {persisted === null ? '' : persisted ? '🔒 Protected storage' : '⚠︎ Storage may be cleared'}
        </span>
      </div>
      {persisted === false && (
        <div className="px-3 pb-3">
          <button
            onClick={async () => {
              const ok = await navigator.storage?.persist?.();
              setPersisted(!!ok);
              toast(ok ? 'Storage protected' : 'The browser declined. Installing the app usually fixes this.');
            }}
            className="min-h-11 w-full rounded-xl border border-line text-sm"
          >
            Ask to protect storage
          </button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 px-3 py-3">
        <button onClick={doExport} className="min-h-11 rounded-xl bg-accent font-semibold text-accent-ink">
          Export backup
        </button>
        <button onClick={() => fileRef.current?.click()} className="min-h-11 rounded-xl border border-line font-semibold">
          Import backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) doImport(f);
            e.target.value = '';
          }}
        />
      </div>
      <div className="px-3 py-3">
        <button onClick={doErase} className="min-h-11 w-full rounded-xl text-sm font-medium text-danger">
          Erase everything
        </button>
      </div>
    </Group>
  );
}

/* ---------- small building blocks ---------- */

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 px-1 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
      <div className="divide-y divide-line overflow-hidden rounded-2xl bg-surface shadow-sm">{children}</div>
      {note && <p className="mt-1.5 px-1 text-xs text-muted">{note}</p>}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 px-3 py-2">
      <div>
        <div>{label}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} className="grid size-9 place-items-center rounded-full text-ink-2 disabled:opacity-25">
      {children}
    </button>
  );
}

/** Text input that saves on blur / Enter rather than on every keystroke */
function BufferedInput({
  value,
  onCommit,
  className = '',
  ...rest
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  maxLength?: number;
  inputMode?: 'decimal' | 'text';
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      {...rest}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onCommit(v)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className={`min-h-11 rounded-xl border border-line bg-surface px-3 outline-none focus:border-accent ${className}`}
    />
  );
}


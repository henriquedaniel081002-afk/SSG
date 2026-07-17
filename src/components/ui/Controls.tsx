import React from 'react';
import { AlertTriangle, RefreshCw, Search, X } from 'lucide-react';
import { Button, cx } from './Primitives';

const controlClass = 'w-full rounded-xl border border-border bg-[#0a110d] px-3 text-sm text-text-primary transition-colors placeholder:text-text-muted hover:border-border-strong focus:border-primary disabled:opacity-55';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cx(controlClass, className)} {...props} />;
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...props }, ref) {
  return <select ref={ref} className={cx(controlClass, className)} {...props} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cx(controlClass, 'min-h-28 py-3', className)} {...props} />;
});

export function SearchInput({ value, onChange, onClear, placeholder = 'Pesquisar…', id, className }: { value: string; onChange: (value: string) => void; onClear?: () => void; placeholder?: string; id?: string; className?: string }) {
  return (
    <div className={cx('relative', className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
      <Input id={id} type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="pl-10 pr-11" />
      {value ? <button type="button" aria-label="Limpar pesquisa" onClick={() => { onChange(''); onClear?.(); }} className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-text-muted hover:bg-surface-hover hover:text-text-primary"><X className="h-4 w-4" aria-hidden="true" /></button> : null}
    </div>
  );
}

export interface TabItem<T extends string> {
  id: T;
  label: string;
  count?: number;
}

export function Tabs<T extends string>({ items, active, onChange, label = 'Seções' }: { items: Array<TabItem<T>>; active: T; onChange: (id: T) => void; label?: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface-elevated p-1">
      {items.map((item) => (
        <button key={item.id} type="button" role="tab" aria-selected={active === item.id} onClick={() => onChange(item.id)} className={`min-h-11 shrink-0 rounded-lg px-3 text-xs font-semibold transition-colors ${active === item.id ? 'bg-primary text-white' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`}>
          {item.label}{item.count !== undefined ? <span className={`ml-2 rounded-full px-1.5 py-0.5 font-mono text-[9px] ${active === item.id ? 'bg-white/15' : 'bg-surface-active'}`}>{item.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function LoadingState({ label = 'Carregando informações…', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-text-secondary"><RefreshCw className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />{label}</div>
      <div className="mt-5 space-y-3" aria-hidden="true">{Array.from({ length: rows }, (_, index) => <div key={index} className="h-11 animate-pulse rounded-xl bg-surface-elevated" />)}</div>
    </div>
  );
}

export function ErrorState({ title = 'Não foi possível carregar', message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-danger/40 bg-danger/8 p-6">
      <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden="true" /><div><h3 className="font-semibold text-text-primary">{title}</h3><p className="mt-1 text-sm text-text-secondary">{message}</p>{onRetry ? <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry} className="mt-4">Tentar novamente</Button> : null}</div></div>
    </div>
  );
}

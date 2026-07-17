import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { LoaderCircle } from 'lucide-react';
import { StatusGarantia } from '../../types';

export const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'border-primary bg-primary text-white hover:border-primary-hover hover:bg-primary-hover',
  secondary: 'border-border bg-surface-elevated text-text-primary hover:border-border-strong hover:bg-surface-hover',
  ghost: 'border-transparent bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary',
  danger: 'border-danger/50 bg-danger/12 text-red-200 hover:bg-danger hover:text-white',
  success: 'border-success/50 bg-success/12 text-emerald-200 hover:bg-success hover:text-slate-950',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'min-h-11 px-3 text-xs',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-sm',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: LucideIcon;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, icon: Icon, disabled, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
      {children}
    </button>
  );
});

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: LucideIcon;
  variant?: ButtonVariant;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon: Icon, className, variant = 'ghost', type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        buttonVariants[variant],
        className,
      )}
      {...props}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
});

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('rounded-2xl border border-border bg-surface shadow-[0_18px_45px_rgba(0,0,0,0.14)]', className)} {...props}>
      {children}
    </div>
  );
}

const statusStyles: Record<StatusGarantia, string> = {
  [StatusGarantia.RECEBIDO]: 'border-slate-500/40 bg-slate-500/12 text-slate-200',
  [StatusGarantia.EM_ANALISE]: 'border-information/45 bg-information/12 text-sky-200',
  [StatusGarantia.AGUARDANDO_PECAS]: 'border-warning/45 bg-warning/12 text-amber-200',
  [StatusGarantia.EM_REPARO]: 'border-orange-500/45 bg-orange-500/12 text-orange-200',
  [StatusGarantia.TESTE_FINAL]: 'border-violet-500/45 bg-violet-500/12 text-violet-200',
  [StatusGarantia.CONCLUIDO]: 'border-success/45 bg-success/12 text-emerald-200',
  [StatusGarantia.ENCERRADO]: 'border-teal-500/45 bg-teal-500/12 text-teal-200',
};

export function StatusBadge({ status, className }: { status: StatusGarantia; className?: string }) {
  return (
    <span className={cx('inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold', statusStyles[status], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {status}
    </span>
  );
}

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p> : null}
        <h1 className="text-balance text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-text-secondary">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2 no-print">{actions}</div> : null}
    </div>
  );
}

export interface FormFieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function FormField({ id, label, hint, error, required, children }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold text-text-secondary">
        {label} {required ? <span className="text-danger" aria-hidden="true">*</span> : null}
      </label>
      {children}
      {error ? <p id={`${id}-error`} className="text-xs text-red-300">{error}</p> : hint ? <p id={`${id}-hint`} className="text-xs text-text-muted">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }: { icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-elevated/45 p-8 text-center">
      {Icon ? <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary"><Icon className="h-6 w-6" aria-hidden="true" /></div> : null}
      <h3 className="font-semibold text-text-primary">{title}</h3>
      {description ? <p className="mt-1 max-w-md text-sm text-text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPageChange }: { page: number; pageSize: number; total: number; onPageChange: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(total, safePage * pageSize);
  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between">
      <span>{start}–{end} de {total}</span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)}>Anterior</Button>
        <span className="min-w-20 text-center font-mono">{safePage} / {totalPages}</span>
        <Button size="sm" variant="secondary" disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)}>Próxima</Button>
      </div>
    </div>
  );
}
